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
    QSlider,
    QComboBox,
    QSpinBox
)
from PySide6.QtCore import Qt
from torch import layout
from backend.persona_crud import (
    create_persona,
    list_private_personas,
    list_public_personas,
)

USER_ID = "a3955cd2-8f12-48cc-925c-835457320613"


def make_trait_slider(name, initial=5):
    label = QLabel(f"{name}: {initial}")

    slider = QSlider(Qt.Horizontal)
    slider.setRange(1, 10)
    slider.setValue(initial)
    slider.setTickInterval(1)
    slider.setTickPosition(QSlider.TicksBelow)

    slider.valueChanged.connect(
        lambda v: label.setText(f"{name}: {v}")
    )

    row = QVBoxLayout()
    row.addWidget(label)
    row.addWidget(slider)

    return row, slider


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
        self.sliders = {}
        submit_btn = QPushButton("Create")

        layout.addWidget(QLabel("Name"))
        layout.addWidget(self.name_input)

        layout.addWidget(QLabel("Description"))
        layout.addWidget(self.desc_input)

        layout.addWidget(QLabel("Interests (comma-separated)"))
        layout.addWidget(self.interests_input)

        layout.addWidget(self.public_checkbox)
        
        # --- Gender Dropdown ---
        self.gender_combo = QComboBox()
        self.gender_combo.addItems([
            "Male",
            "Female",
            "Non-binary",
            "Other",
            "Prefer not to say"
        ])
        layout.addWidget(QLabel("Gender"))
        layout.addWidget(self.gender_combo)
        
        # --- Race Dropdown ---
        self.race_combo = QComboBox()
        self.race_combo.addItems([
            "White",
            "Black",
            "Asian",
            "Hispanic/Latino",
            "Middle Eastern",
            "Native American",
            "Mixed",
            "Other"
        ])
        layout.addWidget(QLabel("Race"))
        layout.addWidget(self.race_combo)

        self.age_spin = QSpinBox()
        self.age_spin.setRange(0, 3000)  # reasonable age range
        self.age_spin.setValue(25)       # default value
        layout.addWidget(QLabel("Age"))
        layout.addWidget(self.age_spin)
        
        ## Browsing behavior sliders
        for trait in ["risk", "attention", "patience", "politics"]:
            row, slider = make_trait_slider(trait, initial=5)
            layout.addLayout(row)
            self.sliders[trait.lower()] = slider
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
        risk = self.sliders["risk"].value()
        attention = self.sliders["attention"].value()
        patience = self.sliders["patience"].value()
        politics = self.sliders["politics"].value()
        gender = self.gender_combo.currentText()
        race = self.race_combo.currentText()
        age = self.age_spin.value()
        ## TODO: validate inputs more robustly
        if not name:
            QMessageBox.warning(self, "Error", "Name is required")
            return

        interests = {"interests": interests}

        p = create_persona(USER_ID, name, description, interests, is_public, risk, attention, patience, politics,
                            gender=gender, race=race, age=age)

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
