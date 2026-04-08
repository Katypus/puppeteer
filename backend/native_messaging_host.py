#!/usr/bin/env python3
"""
Firefox Native Messaging Host for Puppeteer Extension

This script handles native messaging protocol communication with the Firefox extension.
It reads JSON messages from stdin and writes JSON responses to stdout.

Native Messaging Protocol:
- Messages are JSON preceded by a 32-bit little-endian integer indicating the message length
- Used for secure IPC between extension and native application
"""

import sys
import json
import struct
import logging
from pathlib import Path
import traceback
from setup_wizard import run_setup_wizard, should_run_setup

# Configure logging to file (avoid stderr which breaks native messaging)
log_dir = Path.home() / ".puppeteer_logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / "native_host.log"
logging.basicConfig(
    filename=str(log_file),
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Log startup
logger.info("=" * 50)
logger.info("Native messaging host starting up...")
try:
    import httpx
    logger.info("httpx imported successfully")
except ImportError as e:
    logger.critical(f"Failed to import httpx: {e}")
    logger.critical("Please install it with: pip install httpx")
    sys.exit(1)


def send_message(message):
    """Send a JSON message to Firefox extension via native messaging protocol."""
    try:
        if message is None:
            logger.error("Attempted to send None message")
            return
        
        message_json = json.dumps(message)
        message_bytes = message_json.encode('utf-8')
        message_length = struct.pack('I', len(message_bytes))
        
        logger.debug(f"Sending message ({len(message_bytes)} bytes): {message}")
        sys.stdout.buffer.write(message_length)
        sys.stdout.buffer.write(message_bytes)
        sys.stdout.buffer.flush()
        logger.debug("Message sent successfully")
    except Exception as e:
        logger.error(f"Error sending message: {e}", exc_info=True)
        # Can't send error back to Firefox if stdout is broken
        # Just log it and hope Firefox catches the error


def read_message():
    """Read a JSON message from Firefox extension via native messaging protocol."""
    try:
        # Read the 4-byte message length
        length_bytes = sys.stdin.buffer.read(4)
        if not length_bytes:
            logger.debug("No more messages, EOF reached")
            return None
        
        if len(length_bytes) < 4:
            logger.error(f"Incomplete length bytes: got {len(length_bytes)}, expected 4")
            return None
        
        message_length = struct.unpack('I', length_bytes)[0]
        logger.debug(f"Reading message of length {message_length}")
        
        if message_length > 1024 * 1024:  # 1MB limit
            logger.error(f"Message length too large: {message_length} bytes")
            return None
        
        # Read the message
        message_bytes = sys.stdin.buffer.read(message_length)
        if not message_bytes:
            logger.debug("Failed to read message bytes")
            return None
        
        if len(message_bytes) < message_length:
            logger.error(f"Incomplete message: got {len(message_bytes)}, expected {message_length}")
            return None
        
        message = json.loads(message_bytes.decode('utf-8'))
        logger.debug(f"Received message: {message}")
        return message
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}", exc_info=True)
        return None
    except Exception as e:
        logger.error(f"Error reading message: {e}", exc_info=True)
        return None


async def handle_api_request(path, options=None):
    """
    Handle API requests by forwarding them to the FastAPI backend.
    
    Args:
        path: The API endpoint path (e.g., '/decide', '/personas')
        options: Optional request options (method, headers, body, etc.)
    
    Returns:
        Dictionary with 'ok', 'status', and 'body' keys
    """
    if options is None:
        options = {}
    
    url = f"http://localhost:8000{path}"
    method = options.get('method', 'GET').upper()
    headers = options.get('headers', {})
    body = options.get('body')
    
    try:
        timeout = httpx.Timeout(120.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            logger.debug(f"Making {method} request to {url}")
            response = await client.request(
                method,
                url,
                headers=headers,
                content=body.encode() if isinstance(body, str) else body,
            )
        
        content_type = response.headers.get('content-type', '')
        response_body = (
            response.json()
            if 'application/json' in content_type
            else response.text
        )
        
        logger.debug(f"API response: status={response.status_code}")
        return {
            'ok': response.status_code < 400,
            'status': response.status_code,
            'body': response_body
        }
    except Exception as e:
        logger.error(f"API request failed: {e}", exc_info=True)
        return {
            'ok': False,
            'status': 0,
            'body': str(e)
        }


async def main():
    """Main native messaging host loop."""
    logger.info("Native messaging host main loop started")
    if should_run_setup(sys.argv):
        return run_setup_wizard()
    try:
        while True:
            try:
                message = read_message()
                if message is None:
                    logger.info("EOF reached, exiting main loop")
                    break
                
                msg_type = message.get('type')
                logger.info(f"Processing message type: {msg_type}")
                
                if msg_type == 'API_FETCH':
                    # Handle API fetch requests
                    path = message.get('path', '/')
                    options = message.get('options', {})
                    logger.debug(f"API_FETCH: {message.get('method', 'GET')} {path}")
                    result = await handle_api_request(path, options)
                    send_message(result)
                else:
                    logger.warning(f"Unknown message type: {msg_type}")
                    send_message({
                        'ok': False,
                        'error': f'Unknown message type: {msg_type}'
                    })
            
            except Exception as e:
                logger.error(f"Error processing message: {e}", exc_info=True)
                try:
                    send_message({
                        'ok': False,
                        'error': str(e)
                    })
                except Exception as send_err:
                    logger.error(f"Failed to send error message: {send_err}")
    
    except Exception as e:
        logger.critical(f"Fatal error in main loop: {e}", exc_info=True)
        try:
            send_message({'ok': False, 'error': f'Fatal error: {str(e)}'})
        except:
            pass
        raise


if __name__ == '__main__':
    import asyncio
    
    try:
        logger.info("Starting asyncio main loop")
        asyncio.run(main())
        logger.info("Native messaging host exited normally")
    except KeyboardInterrupt:
        logger.info("Native messaging host interrupted")
    except Exception as e:
        logger.critical(f"Fatal error: {e}", exc_info=True)
        try:
            send_message({'ok': False, 'error': f'Fatal error: {e}'})
        except:
            logger.error("Could not send error message to Firefox")
        sys.exit(1)
