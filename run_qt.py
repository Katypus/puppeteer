import sys
from PySide6.QtWidgets import (
    QApplication,
    QWidget,
    QPushButton,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QTextEdit,
    QListWidget,
    QListWidgetItem,
    QCheckBox,
    QMessageBox,
    QStackedWidget,
)
from backend.persona_crud import (
    create_persona,
    list_private_personas,
    list_public_personas,
)

USER_ID = "e3e07f73-b687-4f56-95ee-b4bc4c82a1d5"


class PersonaApp(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Persona Manager")
        self.resize(700, 450)

        self._build_ui()

    def _build_ui(self):
        main_layout = QHBoxLayout(self)

        # ---- Left navigation ----
        nav_layout = QVBoxLayout()
        self.create_btn = QPushButton("Create Persona")
        self.private_btn = QPushButton("My Personas")
        self.public_btn = QPushButton("Public Personas")

        nav_layout.addWidget(self.create_btn)
        nav_layout.addWidget(self.private_btn)
        nav_layout.addWidget(self.public_btn)
        nav_layout.addStretch()

        # ---- Right content ----
        self.stack = QStackedWidget()

        self.create_view = self._build_create_view()
        self.private_view = self._build_private_list()
        self.public_view = self._build_public_list()

        self.stack.addWidget(self.create_view)
        self.stack.addWidget(self.private_view)
        self.stack.addWidget(self.public_view)

        main_layout.addLayout(nav_layout, 1)
        main_layout.addWidget(self.stack, 3)

        # ---- Signals ----
        self.create_btn.clicked.connect(lambda: self.stack.setCurrentWidget(self.create_view))
        self.private_btn.clicked.connect(self.load_private_personas)
        self.public_btn.clicked.connect(self.load_public_personas)

    # ---------- Views ----------

    def _build_create_view(self):
        w = QWidget()
        layout = QVBoxLayout(w)

        self.name_input = QLineEdit()
        self.desc_input = QTextEdit()
        self.interests_input = QLineEdit()
        self.public_checkbox = QCheckBox("Make public")

        submit_btn = QPushButton("Create")

        layout.addWidget(QLabel("Name"))
        layout.addWidget(self.name_input)

        layout.addWidget(QLabel("Description"))
        layout.addWidget(self.desc_input)

        layout.addWidget(QLabel("Interests (comma-separated)"))
        layout.addWidget(self.interests_input)

        layout.addWidget(self.public_checkbox)
        layout.addWidget(submit_btn)
        layout.addStretch()

        submit_btn.clicked.connect(self.create_persona)

        return w

    def _build_private_list(self):
        w = QWidget()
        layout = QVBoxLayout(w)

        self.private_list = QListWidget()
        layout.addWidget(QLabel("My Personas"))
        layout.addWidget(self.private_list)

        return w

    def _build_public_list(self):
        w = QWidget()
        layout = QVBoxLayout(w)

        self.public_list = QListWidget()
        layout.addWidget(QLabel("Public Personas"))
        layout.addWidget(self.public_list)

        return w

    # ---------- Actions ----------

    def create_persona(self):
        name = self.name_input.text().strip()
        description = self.desc_input.toPlainText().strip()
        interests = [i.strip() for i in self.interests_input.text().split(",") if i.strip()]
        is_public = self.public_checkbox.isChecked()

        if not name:
            QMessageBox.warning(self, "Error", "Name is required")
            return

        persona_json = {"interests": interests}

        p = create_persona(USER_ID, name, description, persona_json, is_public)

        QMessageBox.information(self, "Success", f"Created persona: {p.name}")

        self.name_input.clear()
        self.desc_input.clear()
        self.interests_input.clear()
        self.public_checkbox.setChecked(False)

    def load_private_personas(self):
        self.private_list.clear()
        self.stack.setCurrentWidget(self.private_view)

        personas = list_private_personas(USER_ID)
        for p in personas:
            label = f"{p.name} ({'public' if p.is_public else 'private'})"
            item = QListWidgetItem(label)
            item.setToolTip(str(p.id))
            self.private_list.addItem(item)

    def load_public_personas(self):
        self.public_list.clear()
        self.stack.setCurrentWidget(self.public_view)

        personas = list_public_personas()
        for p in personas:
            label = f"{p.name} — owner {p.owner_id}"
            item = QListWidgetItem(label)
            item.setToolTip(str(p.id))
            self.public_list.addItem(item)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = PersonaApp()
    window.show()
    sys.exit(app.exec())
