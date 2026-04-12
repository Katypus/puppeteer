# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the Puppeteer FastAPI backend
# Build: py -m PyInstaller puppeteer-backend.spec

a = Analysis(
    ['backend_launcher.py'],
    pathex=[],
    binaries=[],
    datas=[('../.env', '.')],
    hiddenimports=[
        # top-level packages
        'uvicorn',
        'fastapi',
        'starlette',
        'pydantic',
        'anyio',
        # uvicorn internals not always auto-detected
        'uvicorn.logging',
        'uvicorn.main',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # app modules
        'app',
        'auth',
        'config',
        'create_tables',
        'database',
        'models',
        'persona_crud',
        'persona_engine',
        'personas',
        'schema',
        'user_crud',
        # sqlalchemy dialect for psycopg2
        'sqlalchemy.dialects.postgresql',
        'psycopg2',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='puppeteer-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
