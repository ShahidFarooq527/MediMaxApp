"use strict";

/* FIREBASE CONFIG */

const firebaseConfig = {
  apiKey: "AIzaSyAeOmEIf4ooqtyXERfaMxyjtosXijaMfPE",
  authDomain: "medimax-7a745.firebaseapp.com",
  projectId: "medimax-7a745",
  storageBucket: "medimax-7a745.firebasestorage.app",
  messagingSenderId: "598760410483",
  appId: "1:598760410483:web:d74feac4a8c96c56d50906",
  measurementId: "G-6K7G9ZD2M0"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const SERVER_TIME = firebase.firestore.FieldValue.serverTimestamp;

/* PACKAGES — RECORD LIMIT REMOVED */

const PACKAGES = {
  Basic: {
    price: 1500,
    days: 30,
    capacity: 100000
  },
  Professional: {
    price: 3500,
    days: 30,
    capacity: 500000
  },
  Premium: {
    price: 7500,
    days: 90,
    capacity: 2000000
  }
};

/* SECTIONS */

const SECTIONS = [
"Patients","Doctors","Appointments","Consultation",
"Prescriptions","Laboratory","Radiology","Billing",
"Pharmacy","Admissions","HR / Staff","Medical History",
"Vitals","Allergies","Immunization","Dental",
"Eye Care","Cardiology","Neurology","Dermatology",
"Pediatrics","Gynecology","Obstetrics","Orthopedics",
"Physiotherapy","Surgery","Emergency","ICU",
"Operation Theatre","Discharge Records","Nursing",
"Pathology","Microbiology","Blood Bank","ECG",
"Ultrasound","X-Ray","MRI","CT Scan",
"Endoscopy","Vaccination","Insurance","Payments",
"Expenses","Income","Suppliers","Inventory",
"Medicines","Medical Equipment","Staff Attendance",
"Staff Salary","Duty Roster","Patient Follow-up",
"Referrals","Lab Reports","Test Results","Diet Plans",
"Bed Management","Ward Management","Ambulance",
"Complaints","Feedback","Certificates","Medical Letters",
"Fitness Certificates","Death Records","Birth Records",
"Chronic Diseases","Diabetes","Hypertension","Asthma",
"Kidney Records","Liver Records","Heart Records",
"Cancer Records","Skin Records","ENT","Mental Health",
"Health Checkup","Preventive Care","Vaccination Records",
"Patient Documents","Consent Forms","Medical History Archive",
"Treatment Plans","Clinical Notes","Doctor Notes",
"Nursing Notes","Surgical Notes","Anesthesia Records",
"Disability Records","Rehabilitation","Home Care",
"Telemedicine","Research","Quality Control",
"Audit Records","Other Records"
];

/* FIXED FIELD LABELS */

const DEFAULT_FIELDS = [
  "Full Name",
  "Patient / Record ID",
  "Date of Birth",
  "Age",
  "Gender",
  "Phone Number",
  "Email Address",
  "Address",
  "Reference / Doctor",
  "Status"
];

/* GLOBAL VARIABLES */

let currentUser = null;
let currentProfile = {};
let records = [];
let requests = [];
let messages = [];

let currentSection = SECTIONS[0];
let editingId = null;

let fieldLabels = [...DEFAULT_FIELDS];

let customColumns = ["Field A","Field B","Field C"];
let customRows = [["","",""]];

let dataUnsubscribe = null;
let requestUnsubscribe = null;
let messageUnsubscribe = null;
let profileUnsubscribe = null;

let registerMode = false;
let busy = false;

/* HELPERS */

function $(id) {
  return document.getElementById(id);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function showMessage(id, message, color) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = color || "#166534";
}

function getDate(value) {
  if (!value) return "—";

  let d;

  if (value.toDate) d = value.toDate();
  else if (value.seconds) d = new Date(value.seconds * 1000);
  else d = new Date(value);

  if (isNaN(d.getTime())) return "—";

  return d.toLocaleDateString();
}

function getDateTime(value) {
  if (!value) return "—";

  let d = value.toDate
    ? value.toDate()
    : new Date(value);

  if (isNaN(d.getTime())) return "—";

  return d.toLocaleString();
}

function getUserRef() {
  if (!currentUser) throw new Error("Please login first.");
  return db.collection("users").doc(currentUser.uid);
}

function getRecordsRef() {
  return getUserRef().collection("records");
}

function getRequestsRef() {
  return getUserRef().collection("requests");
}

/* PACKAGE EXPIRY */

function isPackageActive() {
  const plan = currentProfile.plan;

  if (!plan || plan.status !== "approved") return false;

  const expiry = plan.endAt || plan.endDate;

  if (!expiry) return false;

  let end;

  if (typeof expiry.toDate === "function") {
    end = expiry.toDate();
  } else if (typeof expiry.seconds === "number") {
    end = new Date(expiry.seconds * 1000);
  } else if (
    typeof expiry === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(expiry)
  ) {
    end = new Date(expiry + "T23:59:59");
  } else {
    end = new Date(expiry);
  }

  if (Number.isNaN(end.getTime())) return false;

  return end >= new Date();
}

function getPlanName() {
  return currentProfile.plan?.name || "None";
}

function getPlanCapacity() {
  return Number(currentProfile.plan?.capacity || 0);
}

function firebaseMessage(error) {
  const code = error?.code || "";

  const messages = {
    "auth/email-already-in-use":"Ye email pehle se registered hai.",
    "auth/invalid-email":"Email address ghalat hai.",
    "auth/weak-password":"Password kam az kam 6 characters ka hona chahiye.",
    "auth/user-not-found":"Account nahi mila.",
    "auth/wrong-password":"Password ghalat hai.",
    "auth/invalid-credential":"Email ya password ghalat hai.",
    "auth/too-many-requests":"Bohat zyada attempts. Kuch dair baad koshish karein.",
    "permission-denied":"Firebase permission denied. Security Rules check karein.",
    "unavailable":"Internet ya Firebase connection check karein."
  };

  return messages[code] || error?.message || "Unknown error.";
}

/* PASSWORD EYE */

function toggleEye(id, button) {
  const input = $(id);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    button.textContent = "🙈";
  } else {
    input.type = "password";
    button.textContent = "👁";
  }
}

/* REGISTER MODE */

function toggleRegister() {
  registerMode = !registerMode;

  $("registerFields").classList.toggle("hidden", !registerMode);

  $("authTitle").textContent =
    registerMode ? "MediMax Registration" : "MediMax Login";

  $("submitAuth").textContent =
    registerMode ? "Create Account" : "Login";

  $("confirmPassword").required = registerMode;
  $("clinicName").required = registerMode;
  $("ownerName").required = registerMode;

  $("password").autocomplete =
    registerMode ? "new-password" : "current-password";

  $("authMsg").textContent = "";
}

/* LOGIN / REGISTRATION */

$("authForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  if (busy) return;

  const email = $("email").value.trim().toLowerCase();
  const password = $("password").value;

  if (!email || !password) return;

  busy = true;
  $("submitAuth").disabled = true;

  showMessage("authMsg", "Please wait...", "#1769aa");

  try {
    if (registerMode) {

      const confirmPassword = $("confirmPassword").value;
      const clinic = $("clinicName").value.trim();
      const owner = $("ownerName").value.trim();
      const phone = $("phone").value.trim();

      if (password !== confirmPassword) {
        throw new Error("Passwords match nahi karte.");
      }

      if (password.length < 6) {
        throw new Error("Password kam az kam 6 characters ka hona chahiye.");
      }

      if (!clinic || !owner) {
        throw new Error("Clinic aur Owner Name likhein.");
      }

      const result = await auth.createUserWithEmailAndPassword(
        email,
        password
      );

      const profile = {
        uid: result.user.uid,
        email: email,
        clinic: clinic,
        owner: owner,
        phone: phone,
        createdAt: SERVER_TIME(),
        plan: null,
        printCount: 0,
        fieldLabels: DEFAULT_FIELDS
      };

      await db.collection("users")
        .doc(result.user.uid)
        .set(profile);

      showMessage("authMsg", "Account successfully create ho gaya.");

    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }

  } catch(error) {
    console.error(error);
    showMessage("authMsg", firebaseMessage(error), "#b91c1c");
  } finally {
    busy = false;
    $("submitAuth").disabled = false;
  }
});

/* FORGOT PASSWORD */

async function resetPassword() {
  const email = $("email").value.trim();

  if (!email) {
    showMessage("authMsg", "Pehle email likhein.", "#b91c1c");
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    showMessage("authMsg", "Password reset link email par bhej diya gaya hai.");
  } catch(error) {
    showMessage("authMsg", firebaseMessage(error), "#b91c1c");
  }
}

/* AUTH STATE */

auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;

    $("auth").classList.add("hidden");
    $("app").classList.remove("hidden");

    try {
      await loadProfile();
      initializePanel();
      startListeners();
    } catch(error) {
      console.error(error);
      alert("Profile load error: " + firebaseMessage(error));
    }

  } else {
    stopListeners();

    currentUser = null;
    currentProfile = {};
    records = [];
    requests = [];
    messages = [];

    $("app").classList.add("hidden");
    $("auth").classList.remove("hidden");
  }
});

/* LOAD PROFILE */

async function loadProfile() {
  const ref = getUserRef();
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    await ref.set({
      uid: currentUser.uid,
      email: currentUser.email || "",
      clinic: "",
      owner: "",
      phone: "",
      plan: null,
      printCount: 0,
      createdAt: SERVER_TIME(),
      fieldLabels: DEFAULT_FIELDS
    });

    currentProfile = {};
  } else {
    currentProfile = snapshot.data() || {};
  }

  fieldLabels = Array.isArray(currentProfile.fieldLabels) &&
    currentProfile.fieldLabels.length === 10
      ? currentProfile.fieldLabels
      : [...DEFAULT_FIELDS];
}

/* INITIALIZE PANEL */

function initializePanel() {
  $("dClinic").textContent = currentProfile.clinic || "—";

  $("profileClinic").value = currentProfile.clinic || "";
  $("profileOwner").value = currentProfile.owner || "";
  $("profilePhone").value = currentProfile.phone || "";

  $("accountInfo").innerHTML = `
    <p>Email: <b>${esc(currentUser.email)}</b></p>
    <p>Account ID: ${esc(currentUser.uid)}</p>
  `;

  renderSectionMenu();
  renderPackageCards();
  renderFieldEditor();

  resetCustomSheet();
  clearForm();

  updateDashboard();
}

/* PROFILE SAVE */

async function saveProfile() {
  try {
    const clinic = $("profileClinic").value.trim();
    const owner = $("profileOwner").value.trim();
    const phone = $("profilePhone").value.trim();

    if (!clinic || !owner) {
      throw new Error("Clinic aur Owner Name zaroor likhein.");
    }

    await getUserRef().update({
      clinic: clinic,
      owner: owner,
      phone: phone
    });

    currentProfile.clinic = clinic;
    currentProfile.owner = owner;
    currentProfile.phone = phone;

    $("dClinic").textContent = clinic;

    showMessage("profileMsg", "Profile successfully save ho gaya.");

  } catch(error) {
    console.error(error);
    showMessage("profileMsg", firebaseMessage(error), "#b91c1c");
  }
}

/* SECTION MENU */

function renderSectionMenu() {
  $("sectionMenu").innerHTML = SECTIONS.map((section, index) => `
    <button onclick="openSection(${index},this)">
     ${String(index + 1).padStart(2, "0")} - ${esc(section)}
    </button>
  `).join("");
}

function openSection(index, button) {
  currentSection = SECTIONS[index];

  document.querySelectorAll(".sidebar button")
    .forEach(b => b.classList.remove("active"));

  if (button) button.classList.add("active");

  $("sectionHeading").textContent = currentSection + " Records";
  $("recordSection").value = currentSection;

  go("records", button);
  clearForm();
}

function go(id, button) {
  document.querySelectorAll(".page")
    .forEach(p => p.classList.remove("active"));

  $(id)?.classList.add("active");

  if (button) {
    document.querySelectorAll(".sidebar button")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");
  }

  if (id === "dashboard") updateDashboard();
  if (id === "records") renderRecords();

  if (id === "packages") {
    renderMyRequests();
    renderMessages();
  }

  if (id === "reports") renderReports();

  const layout = document.querySelector(".layout");
  const sidebar = $("sidebar");

  if (window.innerWidth <= 850) {
    sidebar.classList.remove("open");
  } else {
    layout.classList.add("menu-collapsed");
  }
}

function toggleMenu() {
  const sidebar = $("sidebar");

  if (window.innerWidth <= 850) {
    sidebar.classList.toggle("open");
  } else {
    document.querySelector(".layout")
      .classList.toggle("menu-collapsed");
  }
}

/* SECTION CHANGE */

function sectionChanged() {
  currentSection = $("recordSection").value;
  $("sectionHeading").textContent = currentSection + " Records";
  clearForm();
}

/* FIXED FIELD EDITOR */

function renderFieldEditor() {
  $("fieldEditorTop").innerHTML =
    fieldLabels.map((label, index) => `
      <div class="fieldbox">
        <label>
          <input
            type="text"
            value="${esc(label)}"
            onchange="changeFieldLabel(${index},this.value)"
            maxlength="100">
        </label>
        <input
          type="text"
          id="fixedField${index}"
          placeholder="${esc(label)}">
      </div>
    `).join("");
}

function changeFieldLabel(index, value) {
  fieldLabels[index] = value.trim() || DEFAULT_FIELDS[index];

  const input = $("fixedField" + index);
  if (input) input.placeholder = fieldLabels[index];
}

/* CUSTOM SPREADSHEET */

function columnName(index) {
  let name = "";
  let n = index + 1;

  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    n = Math.floor((n - 1) / 26);
  }

  return name;
}

function resetCustomSheet() {
  customColumns = ["Field A", "Field B", "Field C"];
  customRows = [["", "", ""]];
  renderCustomSheet();
}

function renderCustomSheet() {
  $("customSheetHead").innerHTML = `
    <tr>
      <th class="sheet-row-number">#</th>
      ${customColumns.map((column, index) => `
        <th>${columnName(index)}</th>
      `).join("")}
      <th class="sheet-action-cell">Actions</th>
    </tr>
  `;

  let labels = `
    <tr class="sheet-label-row">
      <td class="sheet-row-number">Field</td>
      ${customColumns.map((column, index) => `
        <td>
          <input
            class="sheet-label-input"
            value="${esc(column)}"
            onchange="updateCustomColumn(${index},this.value)"
            maxlength="100">
        </td>
      `).join("")}
      <td class="sheet-action-cell">Column Names</td>
    </tr>
  `;

  let rows = customRows.map((row, rowIndex) => `
    <tr class="sheet-data-row">
      <td class="sheet-row-number">${rowIndex + 1}</td>

      ${customColumns.map((column, colIndex) => `
        <td>
          <input
            value="${esc(row[colIndex] || "")}"
            onchange="updateCustomCell(${rowIndex},${colIndex},this.value)"
            maxlength="1000">
        </td>
      `).join("")}

      <td class="sheet-action-cell">
        <button type="button" class="danger"
          onclick="deleteCustomRow(${rowIndex})">
          Delete Row
        </button>
      </td>
    </tr>
  `).join("");

  $("customSheetBody").innerHTML = labels + rows;
}

function updateCustomColumn(index, value) {
  customColumns[index] = value.trim() || columnName(index);
  renderCustomSheet();
}

function updateCustomCell(row, col, value) {
  customRows[row][col] = value;
}

function addCustomRow() {
  customRows.push(Array(customColumns.length).fill(""));
  renderCustomSheet();
}

function deleteCustomRow(index) {
  if (customRows.length <= 1) {
    alert("Kam az kam aik row zaroori hai.");
    return;
  }

  customRows.splice(index, 1);
  renderCustomSheet();
}

function addCustomColumn() {
  if (customColumns.length >= 30) {
    alert("Maximum 30 custom columns allowed hain.");
    return;
  }

  const index = customColumns.length;
  customColumns.push("Field " + columnName(index));

  customRows.forEach(row => row.push(""));

  renderCustomSheet();
}

function deleteCustomColumn() {
  if (customColumns.length <= 1) {
    alert("Kam az kam aik column zaroori hai.");
    return;
  }

  if (!confirm("Last custom column delete karna hai?")) return;

  customColumns.pop();
  customRows.forEach(row => row.pop());

  renderCustomSheet();
}

/* CLEAR FORM */

function clearForm() {
  editingId = null;

  $("recordTitle").value = "";
  $("recordDate").value = new Date().toISOString().slice(0, 10);

  $("recordNote").value = "";
  $("recordDetails").value = "";

  fieldLabels.forEach((label, index) => {
    const input = $("fixedField" + index);
    if (input) input.value = "";
  });

  resetCustomSheet();
  $("recordMsg").textContent = "";
}

/* CHARACTER USAGE CALCULATION */

function calculateRecordCharacters(record) {
  const content = {
    section: record.section || "",
    title: record.title || "",
    date: record.date || "",
    fieldLabels: record.fieldLabels || [],
    fixedFields: record.fixedFields || {},
    customColumns: record.customColumns || [],
    customRowsJSON: record.customRowsJSON || "",
    note: record.note || "",
    details: record.details || ""
  };

  return JSON.stringify(content).length;
}

/* SYNC CHARACTER USAGE */

async function syncUsedCharacters() {
  if (!currentUser) return 0;

  const snapshot = await getRecordsRef().get();

  const usedCharacters = snapshot.docs.reduce((total, doc) => {
    return total + calculateRecordCharacters(doc.data());
  }, 0);

  await getUserRef().update({
    "plan.usedCharacters": usedCharacters
  });

  currentProfile.plan = {
    ...(currentProfile.plan || {}),
    usedCharacters
  };

  updateDashboard();

  return usedCharacters;
}

/* COLLECT FORM DATA */

function collectRecord() {
  const fixedFields = {};

  fieldLabels.forEach((label, index) => {
    fixedFields[label] = $("fixedField" + index)?.value || "";
  });

  return {
    section: $("recordSection").value,
    title: $("recordTitle").value.trim(),
    date: $("recordDate").value,
    fieldLabels: [...fieldLabels],
    fixedFields: fixedFields,
    customColumns: [...customColumns],
    customRowsJSON: JSON.stringify(customRows),
    note: $("recordNote").value.trim(),
    details: $("recordDetails").value.trim(),
    updatedAt: SERVER_TIME()
  };
}

/* SAVE RECORD — UNLIMITED RECORD COUNT, CHARACTER CAPACITY CHECK */

async function saveRecord() {
  if (!currentUser) return;

  try {
    if (!isPackageActive()) {
      alert("Record save karne ke liye active package zaroori hai.");
      go("packages");
      return;
    }

    const capacity = getPlanCapacity();

    if (capacity <= 0) {
      alert("Aapke package ki Character Capacity set nahi hai. Admin se rabta karein.");
      return;
    }

    const data = collectRecord();

    if (!data.title) {
      alert("Record Title / ID likhein.");
      return;
    }

    const newRecordCharacters = calculateRecordCharacters(data);

    let oldRecordCharacters = 0;

    if (editingId) {
      const oldRecord = records.find(r => r.id === editingId);

      if (oldRecord) {
        oldRecordCharacters = calculateRecordCharacters(oldRecord);
      }
    }

    const currentUsed = Number(currentProfile.plan?.usedCharacters || 0);

    const newTotal = Math.max(
      0,
      currentUsed - oldRecordCharacters + newRecordCharacters
    );

    if (newTotal > capacity) {
      const remaining = Math.max(0, capacity - currentUsed);

      alert(
        "Character Capacity complete ho rahi hai.\n\n" +
        "Capacity: " + capacity.toLocaleString() + "\n" +
        "Used: " + currentUsed.toLocaleString() + "\n" +
        "Remaining: " + remaining.toLocaleString() + "\n" +
        "Is record ke liye: " + newRecordCharacters.toLocaleString() +
        " characters chahiye."
      );

      return;
    }

    const ref = editingId
      ? getRecordsRef().doc(editingId)
      : getRecordsRef().doc();

    if (!editingId) {
      data.createdAt = SERVER_TIME();
    }

    await ref.set(data, {merge: true});

    await syncUsedCharacters();

    editingId = null;

    showMessage("recordMsg", "Record successfully save ho gaya.");

    clearForm();

  } catch(error) {
    console.error(error);

    showMessage(
      "recordMsg",
      firebaseMessage(error),
      "#b91c1c"
    );
  }
}

/* LOAD RECORDS */

function startRecordListener() {
  if (dataUnsubscribe) dataUnsubscribe();

  dataUnsubscribe = getRecordsRef()
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      records = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));

      renderRecords();
      updateDashboard();
      renderReports();

    }, error => {
      console.error(error);

      showMessage(
        "recordMsg",
        firebaseMessage(error),
        "#b91c1c"
      );
    });
}

/* RENDER RECORDS */

function renderRecords() {
  const q = ($("search").value || "").trim().toLowerCase();

  const filtered = records.filter(record => {
    const searchText = [
      record.title,
      record.section,
      record.details,
      record.note,
      record.date,
      JSON.stringify(record.fixedFields || {}),
      JSON.stringify(record.customColumns || []),
      record.customRowsJSON || ""
    ].join(" ").toLowerCase();

    return searchText.includes(q);
  });

  $("recordRows").innerHTML = filtered.map(record => {
    let rows = [];

    try {
      if (record.customRowsJSON) {
        rows = JSON.parse(record.customRowsJSON);
      } else if (Array.isArray(record.customRows)) {
        rows = record.customRows;
      }
    } catch(error) {
      rows = [];
    }

    if (!Array.isArray(rows)) rows = [];

    const fixedHTML = Object.entries(record.fixedFields || {})
      .map(([label, value]) => `
        <tr>
          <th>${esc(label)}</th>
          <td>${esc(value)}</td>
        </tr>
      `).join("");

    const columns = Array.isArray(record.customColumns)
      ? record.customColumns
      : [];

    const spreadsheetHTML = columns.length ? `
      <h4>Custom Spreadsheet</h4>
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              ${columns.map(col => `<th>${esc(col)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${columns.map((col, index) => `
                  <td>${esc(
                    Array.isArray(row) ? row[index] : row?.cells?.[index]
                  )}</td>
                `).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    ` : "";

    return `
      <tr class="${q ? "search-found" : ""}">
        <td>${esc(record.section || "")}</td>
        <td>
          <b>${esc(record.title || "")}</b>
          ${q ? '<br><span class="search-match">✓ Record Found</span><br>' : '<br>'}
          ${esc(record.details || "")}

          <details style="margin-top:10px">
            <summary style="cursor:pointer;color:#1769aa">
              View Complete Record
            </summary>

            <div style="margin-top:10px">
              <h4>Fixed Fields</h4>
              <div class="tablewrap">
                <table>
                  <tbody>
                    ${fixedHTML || '<tr><td>No fixed fields</td></tr>'}
                  </tbody>
                </table>
              </div>

              ${spreadsheetHTML}

              <h4>Note</h4>
              <p>${esc(record.note || "No note")}</p>

              <h4>Record Details / Summary</h4>
              <p>${esc(record.details || "No details")}</p>
            </div>
          </details>
        </td>

        <td>${esc(record.date || "—")}</td>

        <td class="no-print">
          <button onclick="editRecord('${esc(record.id)}')">Edit</button>
          <button class="danger" onclick="deleteRecord('${esc(record.id)}')">Delete</button>
        </td>
      </tr>
    `;
  }).join("") || `
    <tr>
      <td colspan="4" class="search-not-found">
        ✕ Koi matching record nahi mila.
      </td>
    </tr>
  `;
}

/* EDIT RECORD */

function editRecord(id) {
  const record = records.find(r => r.id === id);
  if (!record) return;

  editingId = id;
  currentSection = record.section || SECTIONS[0];

  $("recordSection").value = currentSection;
  $("sectionHeading").textContent = currentSection + " Records";

  fieldLabels = Array.isArray(record.fieldLabels) &&
    record.fieldLabels.length === 10
      ? [...record.fieldLabels]
      : [...DEFAULT_FIELDS];

  renderFieldEditor();

  $("recordTitle").value = record.title || "";
  $("recordDate").value = record.date || "";
  $("recordNote").value = record.note || "";
  $("recordDetails").value = record.details || "";

  fieldLabels.forEach((label, index) => {
    const input = $("fixedField" + index);
    if (input) input.value = record.fixedFields?.[label] || "";
  });

  customColumns = Array.isArray(record.customColumns)
    ? [...record.customColumns]
    : ["Field A"];

  try {
    customRows = record.customRowsJSON
      ? JSON.parse(record.customRowsJSON)
      : [["", "", ""]];
  } catch(error) {
    customRows = [["", "", ""]];
  }

  if (!Array.isArray(customRows) || !customRows.length) {
    customRows = [Array(customColumns.length).fill("")];
  }

  customRows = customRows.map(row => {
    const result = [...row];

    while (result.length < customColumns.length) {
      result.push("");
    }

    return result.slice(0, customColumns.length);
  });

  renderCustomSheet();

  $("recordMsg").textContent = "Editing Record: " + id;

  go("records");
  window.scrollTo({top: 0, behavior: "smooth"});
}

/* DELETE RECORD */

async function deleteRecord(id) {
  if (!confirm("Kya aap ye record permanently delete karna chahte hain?")) {
    return;
  }

  try {
    await getRecordsRef().doc(id).delete();
    await syncUsedCharacters();

    alert("Record delete ho gaya.");

  } catch(error) {
    console.error(error);
    alert(firebaseMessage(error));
  }
}

/* DASHBOARD — CHARACTER USAGE, NOT RECORD COUNT */

function updateDashboard() {
  if (!currentUser) return;

  $("dClinic").textContent = currentProfile.clinic || "—";
  $("dRecords").textContent = records.length;
  $("dPlan").textContent = getPlanName();

  $("dExpiry").textContent =
    currentProfile.plan?.endDate ||
    (currentProfile.plan?.endAt ? getDate(currentProfile.plan.endAt) : "—");

  const usedSections = new Set(records.map(r => r.section));
  $("dSections").textContent = usedSections.size;

  const used = Number(currentProfile.plan?.usedCharacters || 0);
  const capacity = getPlanCapacity();
  const remaining = Math.max(0, capacity - used);

  if (capacity > 0) {
    $("usageText").textContent =
      used.toLocaleString() + " / " +
      capacity.toLocaleString() + " characters — Remaining: " +
      remaining.toLocaleString();

    $("usageBar").style.width =
      Math.min(100, used / capacity * 100) + "%";
  } else {
    $("usageText").textContent =
      used.toLocaleString() + " characters used — Capacity not set";

    $("usageBar").style.width = "0%";
  }

  const printCount = Number(currentProfile.printCount || 0);

  $("printUsageText").textContent =
    printCount.toLocaleString() + " prints";

  $("printUsageBar").style.width = "0%";

  const latest = requests[0];

  $("latestRequest").innerHTML = latest
    ? `
      <b>${esc(latest.name)}</b>
      <br>Status: ${esc(latest.status)}
      <br>Request Date: ${getDateTime(latest.createdAt)}
    `
    : "No request yet.";
}

/* PACKAGE CARDS */

function renderPackageCards() {
  $("packageCards").innerHTML =
    Object.entries(PACKAGES).map(([name, p]) => `
      <div class="card">
        <h3>${esc(name)}</h3>
        <div class="stat">Rs. ${p.price}</div>
        <p>Duration: ${p.days} Days</p>
        <p>Character Capacity: ${p.capacity.toLocaleString()}</p>
        <p>Records: Unlimited</p>
        <button onclick="requestPackage('${name}')">
          Request Package
        </button>
      </div>
    `).join("");
}

/* REQUEST PACKAGE */

async function requestPackage(name) {
  const p = PACKAGES[name];
  if (!p) return;

  if (!confirm(
    name + " package request karna hai?\nPrice: Rs. " + p.price
  )) return;

  try {
    const existing = requests.find(r => r.status === "pending");

    if (existing) {
      alert("Aapki aik package request pehle hi pending hai.");
      return;
    }

    await getRequestsRef().add({
      uid: currentUser.uid,
      userId: currentUser.uid,
      email: currentUser.email || "",
      clinic: currentProfile.clinic || "",
      owner: currentProfile.owner || "",
      name: name,
      price: p.price,
      days: p.days,
      capacity: p.capacity,
      status: "pending",
      reason: "",
      createdAt: SERVER_TIME()
    });

    alert("Package request Admin ko send ho gayi.");
    go("packages");

  } catch(error) {
    console.error(error);
    alert("Request send nahi hui: " + firebaseMessage(error));
  }
}

/* PACKAGE REQUEST LISTENER */

function startRequestListener() {
  if (requestUnsubscribe) requestUnsubscribe();

  requestUnsubscribe = getRequestsRef()
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      requests = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));

      renderMyRequests();
      renderMessageRequestOptions();
      updateDashboard();

    }, error => {
      console.error("Request listener:", error);
    });
}

/* MY REQUESTS */

function renderMyRequests() {
  $("myRequests").innerHTML = requests.map(r => `
    <div class="card">
      <b>${esc(r.name)}</b>
      <p>Price: Rs. ${esc(r.price)}</p>
      <p>Character Capacity: ${Number(r.capacity || PACKAGES[r.name]?.capacity || 0).toLocaleString()}</p>
      <p>Records: Unlimited</p>
      <p>Status:
        <span class="badge ${esc(r.status)}">${esc(r.status)}</span>
      </p>
      <p>Request Date: ${getDateTime(r.createdAt)}</p>
      ${r.reason ? `<p>Reason: ${esc(r.reason)}</p>` : ""}
      ${r.startDate ? `<p>Start: ${esc(r.startDate)}</p>` : ""}
      ${r.endDate ? `<p>End: ${esc(r.endDate)}</p>` : ""}
    </div>
  `).join("") || "No package requests yet.";

  const plan = currentProfile.plan;

  $("pName").textContent = plan?.name || "None";
  $("pStatus").textContent = plan?.status || "No active plan";
  $("pStart").textContent = plan?.startDate || "—";
  $("pEnd").textContent = plan?.endDate || "—";
}

/* MESSAGE REQUEST OPTIONS */

function renderMessageRequestOptions() {
  const oldValue = $("messageRequest").value;

  $("messageRequest").innerHTML = requests.map(r => `
    <option value="${esc(r.id)}">
      ${esc(r.name)} — ${esc(r.status)}
    </option>
  `).join("");

  if (requests.some(r => r.id === oldValue)) {
    $("messageRequest").value = oldValue;
  }

  renderMessages();
}

/* MESSAGE LISTENER */

function startMessageListener() {
  if (messageUnsubscribe) messageUnsubscribe();

  if (!requests.length) {
    messages = [];
    $("conversation").textContent = "No messages.";
    return;
  }

  renderMessages();
}

/* RENDER MESSAGES */

async function renderMessages() {
  const id = $("messageRequest").value;

  if (!id) {
    $("conversation").textContent = "No messages.";
    return;
  }

  $("conversation").textContent = "Loading messages...";

  if (messageUnsubscribe) {
    messageUnsubscribe();
    messageUnsubscribe = null;
  }

  const ref = getRequestsRef().doc(id);

  messageUnsubscribe = ref.collection("messages")
    .orderBy("createdAt", "asc")
    .onSnapshot(snapshot => {
      messages = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));

      $("conversation").innerHTML =
        messages.map(m => `
          <div class="message ${m.from === "admin" ? "admin" : ""}">
            <b>${m.from === "admin" ? "Admin" : "You"}:</b>
            <p>${esc(m.text)}</p>
            <div class="small">${getDateTime(m.createdAt)}</div>
          </div>
        `).join("") || "No messages yet.";

    }, error => {
      console.error(error);
      $("conversation").textContent = "Messages load nahi ho sake.";
    });
}

/* SEND MESSAGE / APPEAL */

async function sendMessage() {
  const id = $("messageRequest").value;
  const text = $("messageText").value.trim();

  if (!id) {
    alert("Request select karein.");
    return;
  }

  if (!text) {
    alert("Message likhein.");
    return;
  }

  if (text.length > 2000) {
    alert("Message maximum 2000 characters ka ho sakta hai.");
    return;
  }

  try {
    await getRequestsRef()
      .doc(id)
      .collection("messages")
      .add({
        from: "user",
        text: text,
        createdAt: SERVER_TIME()
      });

    $("messageText").value = "";
    alert("Message Admin ko send ho gaya.");

  } catch(error) {
    console.error(error);
    alert(firebaseMessage(error));
  }
}

/* REFRESH PROFILE */

async function refreshProfileData() {
  const snapshot = await getUserRef().get();

  if (snapshot.exists) {
    currentProfile = snapshot.data() || {};
  }

  updateDashboard();
  renderMyRequests();
}

/* REPORTS */

function renderReports() {
  const counts = {};

  SECTIONS.forEach(section => counts[section] = 0);

  records.forEach(record => {
    counts[record.section] = (counts[record.section] || 0) + 1;
  });

  $("reportRows").innerHTML =
    SECTIONS.filter(section => counts[section] > 0)
      .map(section => `
        <tr>
          <td>${esc(section)}</td>
          <td>${counts[section]}</td>
        </tr>
      `).join("") || `
        <tr><td colspan="2">No records found.</td></tr>
      `;
}

/* PROFILE LISTENER */

function startProfileListener() {
  if (profileUnsubscribe) profileUnsubscribe();

  profileUnsubscribe = getUserRef().onSnapshot(snapshot => {
    if (snapshot.exists) {
      currentProfile = snapshot.data() || {};

      updateDashboard();
      renderMyRequests();

      $("dClinic").textContent = currentProfile.clinic || "—";
    }
  }, error => console.error(error));
}

/* START ALL LISTENERS */

function startListeners() {
  stopListeners();

  startRecordListener();
  startRequestListener();
  startProfileListener();
}

/* STOP LISTENERS */

function stopListeners() {
  if (dataUnsubscribe) dataUnsubscribe();
  if (requestUnsubscribe) requestUnsubscribe();
  if (messageUnsubscribe) messageUnsubscribe();
  if (profileUnsubscribe) profileUnsubscribe();

  dataUnsubscribe = null;
  requestUnsubscribe = null;
  messageUnsubscribe = null;
  profileUnsubscribe = null;
}

/* TXT BACKUP */

async function backupTxt() {
  try {
    if (!currentUser) {
      alert("Pehle login karein.");
      return;
    }

    const backup = {
      app: "MediMax",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      profile: currentProfile,
      records: records,
      requests: requests
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      {type: "text/plain;charset=utf-8"}
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "MediMax-Backup-" +
      new Date().toISOString().slice(0,10) + ".txt";

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);

  } catch(error) {
    console.error(error);
    alert("Backup nahi ban saka: " + firebaseMessage(error));
  }
}

/* TXT RESTORE */

async function restoreTxt(input) {
  const file = input.files[0];
  if (!file) return;

  if (!confirm(
    "Backup restore karne se records add/update honge. Continue?"
  )) {
    input.value = "";
    return;
  }

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (
      !backup ||
      backup.app !== "MediMax" ||
      !Array.isArray(backup.records)
    ) {
      throw new Error("Invalid MediMax backup file.");
    }

    const batchLimit = 400;
    let batch = db.batch();
    let count = 0;

    async function commit() {
      if (count > 0) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }

    for (const record of backup.records) {
      if (!record.id) continue;

      const data = {...record};
      delete data.id;

      const ref = getRecordsRef().doc(record.id);

      batch.set(ref, data, {merge: true});
      count++;

      if (count >= batchLimit) await commit();
    }

    await commit();

    // Usage is recalculated AFTER all records have been restored.
    await syncUsedCharacters();

    await loadProfile();

    alert("Backup successfully restore ho gaya.");

  } catch(error) {
    console.error(error);
    alert("Restore error: " + firebaseMessage(error));
  } finally {
    input.value = "";
  }
}

/* PRINT HELPERS */

function preparePrintPage(id) {
  const page = $(id);
  if (!page) return false;

  const area = $("printArea");
  area.innerHTML = "";

  const clone = page.cloneNode(true);
  clone.classList.add("page", "active");
  clone.classList.remove("hidden");

  clone.querySelectorAll("input,textarea,select").forEach(input => {
    const value = input.value || "";
    const div = document.createElement("div");

    div.className = "print-value";
    div.textContent = value;

    input.replaceWith(div);
  });

  clone.querySelectorAll("button,.no-print").forEach(el => {
    el.remove();
  });

  area.appendChild(clone);
  return true;
}

function printSection(id) {
  if (!preparePrintPage(id)) return;

  window.print();

  setTimeout(() => {
    $("printArea").innerHTML = "";
  }, 1500);
}

function printCurrent() {
  const page = document.querySelector(".page.active");
  if (!page) return;

  printSection(page.id);
}

/* LOGOUT */

async function logout() {
  if (!confirm("Kya aap logout karna chahte hain?")) return;

  try {
    stopListeners();
    await auth.signOut();
  } catch(error) {
    console.error(error);
    alert(firebaseMessage(error));
  }
}

/* VISIBILITY REFRESH */

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentUser) {
    refreshProfileData();
  }
});

/* INITIAL FORM SETTINGS */

$("recordDate").value = new Date().toISOString().slice(0, 10);

$("recordSection").innerHTML =
  SECTIONS.map(section => `
    <option value="${esc(section)}">${esc(section)}</option>
  `).join("");

$("recordSection").value = SECTIONS[0];

/* END */
