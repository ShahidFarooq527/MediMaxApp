/* ============================================================
   MEDIMAX COMPLETE USER PANEL — UPDATED APP.JS
   Firebase Compat SDK 11.10.0

   Features:
   - Unlimited records within character capacity
   - Atomic character capacity calculation
   - Separate monthly action counters
   - Save/Edit, Delete, Search, Read
   - Add Row, Add Column, Delete Row, Delete Column
   - Profile Update, Package Request, Support Message
   - Backup, Restore, Print
   - Dashboard and Reports usage
   - Search found / not-found messages
   - Monthly usage reset
   - Package approval and expiry validation
   ============================================================ */


/* ================= FIREBASE CONFIG ================= */

const firebaseConfig = {
  apiKey: "AIzaSyAeOmEIf4ooqtyXERfaMxyjtosXijaMfPE",
  authDomain: "medimax-7a745.firebaseapp.com",
  projectId: "medimax-7a745",
  storageBucket: "medimax-7a745.firebasestorage.app",
  messagingSenderId: "598760410483",
  appId: "1:598760410483:web:d74feac4a8c96c56d50906",
  measurementId: "G-6K7G9ZD2M0"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const SERVER_TIME = firebase.firestore.FieldValue.serverTimestamp;


/* ================= GLOBAL VARIABLES ================= */

let currentUser = null;
let currentProfile = null;

let records = [];
let requests = [];
let messages = [];

let currentSection = "Patients";
let editingRecordId = null;

let registerMode = false;
let isSaving = false;
let isRestoring = false;

let searchTimer = null;
let lastSearch = "";
let searchStatusElement = null;
let searchQuery = "";
let searchOptimisticCount = 0;
let searchOptimisticPeriod = "";
let searchCounterQueue = Promise.resolve();
let customColumns = ["Field A", "Field B", "Field C"];
let customRows = [["", "", ""]];

let dataUnsubscribe = null;
let requestUnsubscribe = null;
let messageUnsubscribe = null;
let profileUnsubscribe = null;


/* ================= MEDICAL SECTIONS ================= */

const SECTIONS = [
  "Patients","Doctors","Appointments","Consultation",
  "Prescriptions","Laboratory","Radiology","Billing",
  "Pharmacy","Admissions","Discharges","Emergency",
  "Operation Theatre","Surgery","ICU","NICU","HDU",
  "Dental","Cardiology","Neurology","Dermatology",
  "Gynecology","Obstetrics","Pediatrics","Orthopedics",
  "Ophthalmology","ENT","Urology","Nephrology","Oncology",
  "Psychiatry","Psychology","Physiotherapy","Nutrition",
  "Vaccination","Immunization","Medical History",
  "Family History","Patient Follow Up","Medical Certificates",
  "Sick Leave","Health Checkup","Blood Bank","Pathology",
  "Microbiology","Hematology","Biochemistry","Histopathology",
  "Ultrasound","X-Ray","CT Scan","MRI","ECG","EEG",
  "Echo","Endoscopy","Colonoscopy","Lab Reports",
  "Radiology Reports","Medical Equipment","Inventory",
  "Stock Management","Suppliers","Purchases","Expenses",
  "Income","Accounts","Payments","Insurance","Claims",
  "Staff","HR / Staff","Attendance","Payroll","Duty Roster",
  "Departments","Hospital Rooms","Beds Management",
  "Ambulance","Home Care","Telemedicine","Research",
  "Clinical Trials","Quality Control","Audit Records",
  "Complaints","Feedback","Legal Records","Other Records"
];


/* ================= FIXED FIELDS ================= */

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


/* ================= PACKAGE LIMITS ================= */

const PACKAGE_LIMITS = {
  Basic: {
    name: "Basic",
    price: 1500,
    days: 30,
    capacity: 100000,
    saveLimit: 1000,
    searchLimit: 5000,
    readLimit: 10000
  },

  Professional: {
    name: "Professional",
    price: 3500,
    days: 30,
    capacity: 500000,
    saveLimit: 5000,
    searchLimit: 25000,
    readLimit: 50000
  },

  Premium: {
    name: "Premium",
    price: 7500,
    days: 90,
    capacity: 2000000,
    saveLimit: 20000,
    searchLimit: 100000,
    readLimit: 200000
  }
};

const PACKAGES = PACKAGE_LIMITS;


/* ================= ACTION DEFINITIONS ================= */

const ACTIONS = {
  saveEdit: {
    label: "Save / Edit",
    limitKey: "saveLimit"
  },

  delete: {
    label: "Delete",
    limitKey: "deleteLimit"
  },

  addRow: {
    label: "Add Row",
    limitKey: "addRowLimit"
  },

  addColumn: {
    label: "Add Column",
    limitKey: "addColumnLimit"
  },

  deleteRow: {
    label: "Delete Row",
    limitKey: "deleteRowLimit"
  },

  deleteColumn: {
    label: "Delete Column",
    limitKey: "deleteColumnLimit"
  },

  search: {
    label: "Search",
    limitKey: "searchLimit"
  },

  read: {
    label: "Read",
    limitKey: "readLimit"
  },

  profileUpdate: {
    label: "Profile Update",
    limitKey: "profileUpdateLimit"
  },

  packageRequest: {
    label: "Package Request",
    limitKey: "packageRequestLimit"
  },

  supportMessage: {
    label: "Support Message",
    limitKey: "supportMessageLimit"
  },

  backup: {
    label: "Backup",
    limitKey: "backupLimit"
  },

  restore: {
    label: "Restore",
    limitKey: "restoreLimit"
  },

  print: {
    label: "Print",
    limitKey: "printLimit"
  }
};


function emptyUsage() {
  return {
    saveEdit: 0,
    delete: 0,
    addRow: 0,
    addColumn: 0,
    deleteRow: 0,
    deleteColumn: 0,
    search: 0,
    read: 0,
    profileUpdate: 0,
    packageRequest: 0,
    supportMessage: 0,
    backup: 0,
    restore: 0,
    print: 0
  };
}


/* ================= HELPERS ================= */

function $(id) {
  return document.getElementById(id);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmt(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function showMessage(id, message, color = "#159c91") {
  const el = $(id);
  if (!el) return;

  el.textContent = message;
  el.style.color = color;
}

function formatDate(value) {
  if (!value) return "-";

  let date;

  if (value.toDate) {
    date = value.toDate();
  } else if (value.seconds) {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  return isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString();
}

function getPeriod() {
  const now = new Date();

  return now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0");
}

function userRef() {
  if (!currentUser) {
    throw new Error("Login required.");
  }

  return db.collection("users").doc(currentUser.uid);
}
function profileRef() {
  return userRef();
}
function recordsRef() {
  return userRef().collection("records");
}

function requestsRef() {
  return userRef().collection("requests");
}

function messagesRef() {
  return userRef().collection("messages");
}

function parseDate(value) {
  if (!value) return null;

  if (value.toDate) return value.toDate();

  if (value.seconds) {
    return new Date(value.seconds * 1000);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return new Date(value + "T23:59:59");
  }

  const date = new Date(value);

  return isNaN(date.getTime()) ? null : date;
}


/* ================= AUTHENTICATION ================= */

function toggleRegister() {
  registerMode = !registerMode;

  $("registerFields").classList.toggle(
    "hidden",
    !registerMode
  );

  $("authTitle").textContent = registerMode
    ? "MediMax Registration"
    : "MediMax Login";

  $("submitAuth").textContent = registerMode
    ? "Create Account"
    : "Login";

  $("confirmPassword").required = registerMode;
  $("clinicName").required = registerMode;
  $("ownerName").required = registerMode;

  showMessage("authMessage", "");
}

function getAuthError(error) {
  const errors = {
    "auth/email-already-in-use": "Email already registered.",
    "auth/invalid-email": "Invalid email.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "User not found.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Try later.",
    "auth/network-request-failed": "Internet connection failed.",
    "permission-denied":
      "Firebase permission denied. Check Security Rules."
  };

  return errors[error.code] ||
    error.message ||
    "Something went wrong.";
}

async function registerUser(email, password) {
  if (password.length < 6) {
    throw new Error(
      "Password must contain at least 6 characters."
    );
  }

  if (password !== $("confirmPassword").value) {
    throw new Error("Passwords do not match.");
  }

  const clinic = $("clinicName").value.trim();
  const owner = $("ownerName").value.trim();

  if (!clinic || !owner) {
    throw new Error(
      "Clinic and owner names are required."
    );
  }

  const credential =
    await auth.createUserWithEmailAndPassword(
      email,
      password
    );

  await db.collection("users")
    .doc(credential.user.uid)
    .set({
      uid: credential.user.uid,
      email,
      clinic,
      owner,
      phone: $("phone").value.trim(),
      createdAt: SERVER_TIME(),
      plan: null,
      printCount: 0,
      fieldLabels: DEFAULT_FIELDS
    });
}

$("authForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const button = $("submitAuth");
  button.disabled = true;

  showMessage("authMessage", "Please wait...");

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    if (registerMode) {
      await registerUser(email, password);
    } else {
      await auth.signInWithEmailAndPassword(
        email,
        password
      );
    }
  } catch (error) {
    showMessage(
      "authMessage",
      getAuthError(error),
      "#c0392b"
    );
  } finally {
    button.disabled = false;
  }
});

async function forgotPassword() {
  const email = $("email").value.trim();

  if (!email) {
    showMessage(
      "authMessage",
      "Enter your email first.",
      "#c0392b"
    );
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);

    showMessage(
      "authMessage",
      "Reset email sent successfully."
    );
  } catch (error) {
    showMessage(
      "authMessage",
      getAuthError(error),
      "#c0392b"
    );
  }
}

async function logout() {
  await auth.signOut();
}

auth.onAuthStateChanged(async function(user) {
  currentUser = user;

  if (!user) {
    cleanupListeners();

    currentProfile = null;
    records = [];
    requests = [];
    messages = [];

    $("app").classList.add("hidden");
    $("auth").classList.remove("hidden");

    return;
  }

  try {
    await loadProfile();

    $("auth").classList.add("hidden");
    $("app").classList.remove("hidden");

    initializeApplication();
  } catch (error) {
    console.error(error);

    showMessage(
      "authMessage",
      error.message,
      "#c0392b"
    );

    await auth.signOut();
  }
});


/* ================= PROFILE ================= */

async function loadProfile() {
  const ref = userRef();
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      uid: currentUser.uid,
      email: currentUser.email,
      clinic: "",
      owner: "",
      phone: "",
      createdAt: SERVER_TIME(),
      plan: null,
      printCount: 0,
      fieldLabels: DEFAULT_FIELDS
    });

    currentProfile = {
      clinic: "",
      owner: "",
      phone: "",
      plan: null,
      fieldLabels: [...DEFAULT_FIELDS]
    };
  } else {
    currentProfile = snap.data();

    if (
      !Array.isArray(currentProfile.fieldLabels) ||
      currentProfile.fieldLabels.length !== 10
    ) {
      currentProfile.fieldLabels = [...DEFAULT_FIELDS];
    }
  }
}

function fillProfileForm() {
  $("profileClinic").value =
    currentProfile.clinic || "";

  $("profileOwner").value =
    currentProfile.owner || "";

  $("profilePhone").value =
    currentProfile.phone || "";

  $("accountInfo").textContent =
    "Email: " + currentUser.email +
    " | Account ID: " + currentUser.uid;
}

async function saveProfile(e) {
  e.preventDefault();

  try {
    const data = {
      clinic: $("profileClinic").value.trim(),
      owner: $("profileOwner").value.trim(),
      phone: $("profilePhone").value.trim()
    };

    await db.runTransaction(async transaction => {
      const ref = userRef();
      const snap = await transaction.get(ref);

      if (!snap.exists) {
        throw new Error("Profile not found.");
      }

      const profile = snap.data();

      validatePlan(profile.plan);

      const state = getUsageState(profile.plan);

      checkActionLimit(
        "profileUpdate",
        state.usage,
        profile.plan
      );

      state.usage.profileUpdate++;

      transaction.update(ref, {
        ...data,
        "plan.usage": state.usage,
        "plan.usagePeriod": state.period
      });
    });

    const refreshed = await userRef().get();

    if (refreshed.exists) {
      currentProfile = refreshed.data();
    }

    showMessage(
      "profileMessage",
      "Profile saved successfully."
    );

    fillProfileForm();
    updateDashboard();

  } catch (error) {
    showMessage(
      "profileMessage",
      error.message,
      "#c0392b"
    );
  }
}


/* ================= APPLICATION INITIALIZATION ================= */

function initializeApplication() {
    listenToProfile();
  createSectionMenu();
  populateSectionSelect();
  renderFixedFields();

  $("recordDate").value =
    new Date().toISOString().slice(0, 10);

  createCustomTable();

  $("search").oninput = handleSearch;

  $("messageRequest").onchange = renderMessages;

  $("profileForm").onsubmit = saveProfile;

  $("recordSection").onchange = function() {
    currentSection = this.value;

    $("recordsHeading").textContent =
      currentSection + " Records";

    renderRecords();
  };

  loadRecords();
  loadRequests();
  loadMessages();

  fillProfileForm();
  renderPackages();

  showPage("dashboardPage");
}
function listenToProfile() {
  if (profileUnsubscribe) {
    profileUnsubscribe();
  }

  profileUnsubscribe = userRef().onSnapshot(
    snapshot => {
      if (!snapshot.exists) return;

      currentProfile = snapshot.data();

      updateDashboard();
      renderPackages();
      renderReports();
      
    },
    error => {
      console.error("Profile Listener Error:", error);
    }
  );
}
function cleanupListeners() {
  [
    dataUnsubscribe,
    requestUnsubscribe,
    messageUnsubscribe,
    profileUnsubscribe
  ].forEach(fn => {
    if (typeof fn === "function") fn();
  });

  dataUnsubscribe = null;
  requestUnsubscribe = null;
  messageUnsubscribe = null;
  profileUnsubscribe = null;

  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
}


/* ================= NAVIGATION ================= */

function createSectionMenu() {
  const menu = $("sectionMenu");
  menu.innerHTML = "";

  SECTIONS.forEach(section => {
    const button = document.createElement("button");

    button.textContent = section;

    button.onclick = function() {
      currentSection = section;
      $("recordSection").value = section;

      $("recordsHeading").textContent =
        section + " Records";

      clearRecordForm();
      showPage("recordsPage");
    };

    menu.appendChild(button);
  });


}

function populateSectionSelect() {
  $("recordSection").innerHTML = "";

  SECTIONS.filter(section => section !== "Restore").forEach(section => {
    const option = document.createElement("option");

    option.value = section;
    option.textContent = section;

    $("recordSection").appendChild(option);
  });
}

function showPage(id) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");
  });

  if ($(id)) {
    $(id).classList.remove("hidden");
  }

  if (window.innerWidth <= 850) {
    $("sidebar").classList.remove("open");
  }

  if (id === "dashboardPage") {
    updateDashboard();
  }

  if (id === "recordsPage") {
    renderRecords();
  }

  if (id === "packagesPage") {
    renderPackages();
    renderRequests();
    renderMessages();
  }

  if (id === "reportsPage") {
    renderReports();
  }
}

function toggleMenu() {
  $("sidebar").classList.toggle("open");
}


/* ================= PLAN STATUS ================= */

function getPlanName() {
  return currentProfile?.plan?.name || "None";
}

function getPlanCapacity() {
  return Number(
    currentProfile?.plan?.capacity || 0
  );
}

function getPlanEndDate() {
  const plan = currentProfile?.plan;

  if (!plan) return null;

  return parseDate(plan.endAt || plan.endDate);
}

function isPlanApproved() {
  return currentProfile?.plan?.status === "approved";
}

function isPlanActive(plan = currentProfile?.plan) {
  if (!plan) return false;

  if (plan.status !== "approved") {
    return false;
  }

  const end = parseDate(plan.endAt || plan.endDate);

  if (!end) return false;

  return end.getTime() >= Date.now();
}

function getPlanStatusText() {
  if (!currentProfile?.plan) {
    return "No Package";
  }

  if (!isPlanApproved()) {
    return "Pending Approval";
  }

  if (!isPlanActive()) {
    return "Expired";
  }

  return "Active";
}

function validatePlan(plan) {
  if (!plan || plan.status !== "approved") {
    throw new Error(
      "Your package is not approved."
    );
  }

  const end = parseDate(plan.endAt || plan.endDate);

  if (!end || end.getTime() < Date.now()) {
    throw new Error(
      "Your package has expired."
    );
  }
}


/* ================= PACKAGE USAGE COUNTERS ================= */

function getUsageState(plan) {
  const period = getPeriod();

  let usage = plan?.usage || {};

  if (plan?.usagePeriod !== period) {
    usage = emptyUsage();
  }

  const clean = emptyUsage();

  Object.keys(clean).forEach(key => {
    clean[key] = Number(usage[key] || 0);
  });

  return {
    period,
    usage: clean
  };
}

function getPlanLimits(plan = currentProfile?.plan) {
  if (!plan) return null;

  const defaults = PACKAGE_LIMITS[plan.name] || {};

  const saveLimit = Number(
    plan.saveLimit ?? defaults.saveLimit ?? 0
  );

  return {
    capacity: Number(
      plan.capacity ?? defaults.capacity ?? 0
    ),

    saveLimit,

    searchLimit: Number(
      plan.searchLimit ?? defaults.searchLimit ?? 0
    ),

    readLimit: Number(
      plan.readLimit ?? defaults.readLimit ?? 0
    ),

    deleteLimit: Number(
      plan.deleteLimit ?? saveLimit
    ),

    profileUpdateLimit: Number(
      plan.profileUpdateLimit ?? saveLimit
    ),

    packageRequestLimit: Number(
      plan.packageRequestLimit ?? saveLimit
    ),

    supportMessageLimit: Number(
      plan.supportMessageLimit ?? saveLimit
    ),

    backupLimit: Number(
      plan.backupLimit ?? saveLimit
    ),

    restoreLimit: Number(
      plan.restoreLimit ?? saveLimit
    ),

    printLimit: Number(
      plan.printLimit ?? saveLimit
    ),

    addRowLimit: Number(
      plan.addRowLimit ?? defaults.addRowLimit ?? saveLimit
    ),

    addColumnLimit: Number(
      plan.addColumnLimit ?? defaults.addColumnLimit ?? saveLimit
    ),

    deleteRowLimit: Number(
      plan.deleteRowLimit ?? defaults.deleteRowLimit ?? saveLimit
    ),

    deleteColumnLimit: Number(
      plan.deleteColumnLimit ?? defaults.deleteColumnLimit ?? saveLimit
    )
  };
}

function getCurrentUsage() {
  const state = getUsageState(currentProfile?.plan);

  // Monthly reset
  if (searchOptimisticPeriod !== state.period) {
    searchOptimisticPeriod = state.period;
    searchOptimisticCount = state.usage.search;
  }

  // Firebase count aur instant local count mein
  // jo zyada ho, woh display karein
  state.usage.search = Math.max(
    state.usage.search,
    searchOptimisticCount
  );

  return state.usage;
}

function getActionLimit(action, limits) {
  const definition = ACTIONS[action];

  if (!definition || !limits) return 0;

  return Number(
    limits[definition.limitKey] || 0
  );
}

function checkActionLimit(action, usage, plan) {
  const definition = ACTIONS[action];

  if (!definition) {
    throw new Error("Invalid action.");
  }

  const limits = getPlanLimits(plan);
  const limit = getActionLimit(action, limits);

  if (limit <= 0) {
    throw new Error(
      definition.label +
      " limit is not configured for this package."
    );
  }

  if (Number(usage[action] || 0) >= limit) {
    throw new Error(
      definition.label +
      " monthly limit reached (" +
      fmt(limit) +
      "). Upgrade your package."
    );
  }
}


/* ================= ATOMIC ACTION COUNTER ================= */

async function consumeUsage(action) {
  const ref = userRef();

  const result = await db.runTransaction(
    async transaction => {
      const snap = await transaction.get(ref);

      if (!snap.exists) {
        throw new Error("Profile not found.");
      }

      const profile = snap.data();
      const plan = profile.plan;

      validatePlan(plan);

      const state = getUsageState(plan);

      checkActionLimit(
        action,
        state.usage,
        plan
      );

      state.usage[action]++;

      transaction.update(ref, {
        "plan.usage": state.usage,
        "plan.usagePeriod": state.period
      });

      return {
        usage: state.usage,
        period: state.period
      };
    }
  );

  if (currentProfile?.plan) {
    currentProfile.plan.usage = result.usage;
    currentProfile.plan.usagePeriod = result.period;
  }

  updateDashboard();
renderUsage();
renderPackages();
renderReports();

return result.usage;
}


/* ================= CUSTOM ROWS PARSER ================= */

function parseCustomRows(value) {
  try {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = JSON.parse(value);

      return Array.isArray(parsed)
        ? parsed
        : [];
    }

    return [];
  } catch (error) {
    console.error(
      "Custom Rows Parse Error:",
      error
    );

    return [];
  }
}


/* ================= CHARACTER CALCULATION ================= */

// Excel-style default column names:
// Field A ... Field Z, Field AA, Field AB ...
function getDefaultColumnName(index) {
  let number = index + 1;
  let letters = "";

  while (number > 0) {
    number--;

    letters =
      String.fromCharCode(65 + (number % 26)) +
      letters;

    number = Math.floor(number / 26);
  }

  return "Field " + letters;
}


// Count Unicode code points.
// Spaces and Urdu/English/symbols are included.
function countTextCharacters(value) {
  return Array.from(String(value ?? "")).length;
}


function calculateRecordCharacters(record) {
  let total = 0;

  // 1. Record title
  total += countTextCharacters(record.title);

  // 2. Fixed field values only
  const fixedFields = record.fixedFields || {};

  Object.values(fixedFields).forEach(value => {
    total += countTextCharacters(value);
  });

  // 3. Custom column headings
  // Exact default names are excluded.
  // User-renamed headings, including spaces, are counted.
  const columns = record.customColumns || [];

  columns.forEach((column, index) => {
    const name = String(column ?? "");
    const defaultName = getDefaultColumnName(index);

    if (name !== defaultName) {
      total += countTextCharacters(name);
    }
  });

  // 4. Custom spreadsheet cell values
  const rows = parseCustomRows(record.customRowsJSON);

  rows.forEach(row => {
    if (!Array.isArray(row)) return;

    row.forEach(value => {
      total += countTextCharacters(value);
    });
  });

  // 5. Note and Details
  total += countTextCharacters(record.note);
  total += countTextCharacters(record.details);

  // Excluded:
  // section, date, fieldLabels, default column names,
  // createdAt, updatedAt and other system-generated data.

  return total;
}


/* ================= RECALCULATE CHARACTER USAGE ================= */


async function recalculateCharacterUsage() {
  try {
    const profileReference = db.collection("users").doc(currentUser.uid);

    // Current records
    const recordsSnap = await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("records")
      .get();

    // Current messages
    const messagesSnap = await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("messages")
      .get();

    // Calculate existing record characters
    const recordTotal = recordsSnap.docs.reduce(
      (sum, doc) => sum + calculateRecordCharacters(doc.data()),
      0
    );

    // Calculate message characters
    const messageTotal = messagesSnap.docs.reduce(
      (sum, doc) => sum + countTextCharacters(doc.data().text),
      0
    );

    const calculatedTotal = recordTotal + messageTotal;

    // Read Firebase's previously saved usage
    await db.runTransaction(async (transaction) => {
      const profileSnap = await transaction.get(profileReference);

      if (!profileSnap.exists) return;

      const profile = profileSnap.data();
      const oldUsed = Math.max(
        0,
        Number(profile.plan?.usedCharacters || 0)
      );

      // Usage must never decrease
      const finalUsed = Math.max(oldUsed, calculatedTotal);

      if (finalUsed > oldUsed) {
        transaction.update(profileReference, {
          "plan.usedCharacters": finalUsed
        });
      }
    });

    console.log("Character usage recalculation completed safely.");

  } catch (error) {
    console.error("Character usage recalculation error:", error);
  }
}



function calculateTotalCharacters() {
  // Record characters
  const recordTotal = records.reduce(
    (sum, record) =>
      sum + calculateRecordCharacters(record),
    0
  );

  // Support message characters (spaces included)
  const messageTotal = messages.reduce(
    (sum, message) =>
      sum + countTextCharacters(message.text),
    0
  );

  return recordTotal + messageTotal;
}


/* ================= LOAD RECORDS ================= */

function loadRecords() {
  if (dataUnsubscribe) {
    dataUnsubscribe();
  }

  dataUnsubscribe = recordsRef().onSnapshot(
    snapshot => {
      records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      updateDashboard();
      renderRecords();
      renderReports();

    },
    error => {
      console.error(error);

      showMessage(
        "recordMessage",
        error.message,
        "#c0392b"
      );
    }
  );
}
/* ================= FIXED FIELDS ================= */

function renderFixedFields(values = {}) {
  const container = $("fixedFieldsContainer");

  container.innerHTML = "";

  const labels =
    currentProfile?.fieldLabels ||
    DEFAULT_FIELDS;

  labels.forEach((label, index) => {
    const div = document.createElement("div");

    div.innerHTML = `
      <label>${escapeHTML(label)}</label>

      <input
        class="fixed-input"
        data-index="${index}"
        maxlength="1000"
        value="${escapeHTML(values[index] ?? "")}">
    `;

    container.appendChild(div);
  });
}

function getFixedFields() {
  const result = {};

  document.querySelectorAll(
    ".fixed-input"
  ).forEach(input => {
    result[input.dataset.index] = input.value;
  });

  return result;
}


/* ================= CUSTOM SPREADSHEET ================= */

function createCustomTable() {
  const head = $("customTableHead");
  const body = $("customTableBody");

  head.innerHTML = "";
  body.innerHTML = "";

  const tr = document.createElement("tr");

  customColumns.forEach((column, index) => {
    const th = document.createElement("th");

    const defaultName = getDefaultColumnName(index);

    const inputValue =
      String(column ?? "") === defaultName
        ? ""
        : column;

    th.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:5px;">

        <input
          class="column-name"
          data-index="${index}"
          maxlength="100"
          placeholder="${escapeHTML(defaultName)}"
          value="${escapeHTML(inputValue)}">

        <button
          type="button"
          class="delete-column-btn"
          onclick="deleteCustomColumn(${index})"
          style="
            background:#dc2626;
            color:white;
            width:100%;
            max-width:100%;
            min-width:0;
            box-sizing:border-box;
            padding:6px 2px;
            margin:3px 0;
            font-size:10px;
            white-space:normal;
            overflow-wrap:anywhere;
            line-height:1.3;
          ">
          Delete Column
        </button>

      </div>
    `;

    tr.appendChild(th);
  });

  const actionHead = document.createElement("th");
  actionHead.textContent = "Row Action";
  tr.appendChild(actionHead);

  head.appendChild(tr);

  customRows.forEach((row, rowIndex) => {
    const rowElement = document.createElement("tr");

    customColumns.forEach((column, colIndex) => {
      const td = document.createElement("td");

      td.innerHTML = `
        <input
          class="custom-cell"
          data-row="${rowIndex}"
          data-col="${colIndex}"
          maxlength="1000"
          value="${escapeHTML(row[colIndex] ?? "")}">
      `;

      rowElement.appendChild(td);
    });

    const actionCell = document.createElement("td");

    actionCell.innerHTML = `
      <button
        type="button"
        onclick="deleteCustomRow(${rowIndex})"
        style="background:#dc2626;color:white;">
        Delete Row
      </button>
    `;

    rowElement.appendChild(actionCell);
    body.appendChild(rowElement);
  });
}

function getCustomData() {
  const columns = Array.from(
    document.querySelectorAll(".column-name")
  ).map((input, index) => {
    const enteredName = input.value;

    return enteredName === ""
      ? getDefaultColumnName(index)
      : enteredName;
  });

  const rows = customRows.map(
    (row, rowIndex) =>
      columns.map((column, colIndex) => {
        const input = document.querySelector(
          `.custom-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`
        );

        return input ? input.value : "";
      })
  );

  return { columns, rows };
}


/* ================= ADD / DELETE ROW ================= */

async function addCustomRow() {
  try {
    await consumeUsage("addRow");

    if (customRows.length >= 1000) {
      alert("Maximum 1000 rows allowed.");
      return;
    }

    const data = getCustomData();

    customColumns = data.columns;
    customRows = data.rows;

    customRows.push(
      Array(customColumns.length).fill("")
    );

    createCustomTable();

  } catch (error) {
    alert(error.message);
  }
}


async function deleteCustomRow(index) {
  try {
    if (customRows.length <= 1) {
      alert("At least one row is required.");
      return;
    }

    await consumeUsage("deleteRow");

    const data = getCustomData();

    customColumns = data.columns;
    customRows = data.rows;

    customRows.splice(index, 1);

    createCustomTable();

  } catch (error) {
    alert(error.message);
  }
}


/* ================= ADD / DELETE COLUMN ================= */

async function addCustomColumn() {
  try {
    if (customColumns.length >= 30) {
      alert("Maximum 30 columns allowed.");
      return;
    }

    await consumeUsage("addColumn");

    const data = getCustomData();

    customColumns = data.columns;
    customRows = data.rows;

    customColumns.push(
      getDefaultColumnName(customColumns.length)
    );

    customRows = customRows.map(row => [
      ...row,
      ""
    ]);

    createCustomTable();

  } catch (error) {
    alert(error.message);
  }
}


async function deleteCustomColumn(index) {
  try {
    if (customColumns.length <= 1) {
      alert("At least one column is required.");
      return;
    }

    await consumeUsage("deleteColumn");

    const data = getCustomData();

    customColumns = data.columns;
    customRows = data.rows;

    customColumns.splice(index, 1);

    customRows = customRows.map(row => {
      const updated = [...row];
      updated.splice(index, 1);
      return updated;
    });

    createCustomTable();

  } catch (error) {
    alert(error.message);
  }
}


/* ================= SAVE FIELD NAMES ================= */

async function saveFieldNames() {
  if (!currentUser || !currentProfile) return;

  const inputs = document.querySelectorAll(
    ".field-label-input"
  );

  const labels = Array.from(inputs).map(
    input => input.value.trim()
  );

  if (labels.length !== 10) {
    alert("Exactly 10 field names are required.");
    return;
  }

  if (labels.some(label => !label)) {
    alert("All field names are required.");
    return;
  }

  if (labels.some(label => label.length > 100)) {
    alert("Field name cannot exceed 100 characters.");
    return;
  }

  try {
    await profileRef().update({
      fieldLabels: labels
    });

    currentProfile.fieldLabels = labels;

    renderFixedFields();

    alert("Field names saved successfully.");
  } catch (error) {
    console.error(error);
    alert("Unable to save field names: " + error.message);
  }
}


/* ================= CLEAR RECORD FORM ================= */

function clearRecordForm() {
  $("recordTitle").value = "";
  $("recordDate").value =
    new Date().toISOString().slice(0, 10);

  $("recordNote").value = "";
  $("recordDetails").value = "";

$("recordSection").value =
  currentSection || "Patients";

  customColumns = [
    "Field A",
    "Field B",
    "Field C"
  ];

  customRows = [
    ["", "", ""]
  ];

  renderFixedFields();
  createCustomTable();

  editingRecordId = null;

  const saveButton = $("saveRecordBtn");

  if (saveButton) {
    saveButton.textContent = "Save Record";
  }
}


/* ================= BUILD RECORD ================= */

function buildRecord() {
  const customData = getCustomData();

  customColumns = customData.columns;
  customRows = customData.rows;

  return {
    section: $("recordSection").value,

    title: $("recordTitle").value,

    date: $("recordDate").value,

    fieldLabels: [
      ...(currentProfile?.fieldLabels || DEFAULT_FIELDS)
    ],

    fixedFields: getFixedFields(),

    customColumns: customData.columns,

    customRowsJSON: JSON.stringify(
      customData.rows
    ),

    note: $("recordNote").value,

    details: $("recordDetails").value
  };
}


/* ================= SAVE RECORD ================= */

async function saveRecord() {
  if (!currentUser || !currentProfile) return;

  if (isSaving) return;

  const record = buildRecord();

  if (!record.title.trim()) {
    alert("Please enter record title.");
    return;
  }

  if (!record.section) {
    alert("Please select a section.");
    return;
  }

  isSaving = true;

  try {
    const isEditing = Boolean(editingRecordId);

    const recordRef = isEditing
      ? recordsRef().doc(editingRecordId)
      : recordsRef().doc();

    await db.runTransaction(async transaction => {
      const profileReference = profileRef();

      const profileSnapshot =
        await transaction.get(profileReference);

      if (!profileSnapshot.exists) {
        throw new Error("User profile not found.");
      }

      const profile = profileSnapshot.data();

      if (!isPlanActive(profile.plan)) {
        throw new Error(
          "Your package is expired or not approved."
        );
      }

      const usageState = getUsageState(
        profile.plan
      );

      const actionName = "saveEdit";

checkActionLimit(
  actionName,
  usageState.usage,
  profile.plan
);

usageState.usage[actionName] =
  Number(usageState.usage[actionName] || 0) + 1;

      const oldSnapshot = isEditing
        ? await transaction.get(recordRef)
        : null;

      if (isEditing && !oldSnapshot.exists) {
        throw new Error("Record not found.");
      }

      const oldRecord = isEditing
        ? oldSnapshot.data()
        : null;

      const newCharacters =
        calculateRecordCharacters(record);

      let oldCharacters = 0;

      if (oldRecord) {
        oldCharacters =
          calculateRecordCharacters(oldRecord);
      }

      const currentUsed = Math.max(
        0,
        Number(profile.plan.usedCharacters || 0)
      );

      const nextUsed =
  currentUsed + Math.max(
    0,
    newCharacters - oldCharacters
  );

      const capacity = Number(
        profile.plan.capacity || 0
      );

      if (
        capacity > 0 &&
        nextUsed > capacity
      ) {
        throw new Error(
          `Character capacity exceeded. Used: ${currentUsed}, New total: ${nextUsed}, Capacity: ${capacity}`
        );
      }

      

      const updatedRecord = {
        ...record,
        createdAt: oldRecord?.createdAt || SERVER_TIME(),
        updatedAt: SERVER_TIME()
      };

      transaction.set(
        recordRef,
        updatedRecord
      );

      transaction.update(
        profileReference,
        {
          "plan.usedCharacters": nextUsed,
          "plan.usage": usageState.usage,
          "plan.usagePeriod": usageState.period
        }
      );
    });

    editingRecordId = null;

    clearRecordForm();

    alert(
      isEditing
        ? "Record updated successfully."
        : "Record saved successfully."
    );

    await loadRecords();

  } catch (error) {
    console.error(error);
    alert(error.message || "Unable to save record.");

  } finally {
    isSaving = false;
  }
}


/* ================= EDIT RECORD ================= */

function editRecord(id) {
  const record = records.find(
    item => item.id === id
  );

  if (!record) {
    alert("Record not found.");
    return;
  }

  editingRecordId = id;

  $("recordSection").value =
    record.section || "Other Records";

  $("recordTitle").value =
    record.title ?? "";

  $("recordDate").value =
    record.date || "";

  $("recordNote").value =
    record.note ?? "";

  $("recordDetails").value =
    record.details ?? "";

  renderFixedFields(
    record.fixedFields || {}
  );

  customColumns = [
    ...(record.customColumns || [])
  ];

  customRows = parseCustomRows(
    record.customRowsJSON || []
  ).map(row => [...row]);

  if (!customColumns.length) {
    customColumns = ["Field A"];
  }

  if (!customRows.length) {
    customRows = [
      Array(customColumns.length).fill("")
    ];
  }

  customRows = customRows.map(row =>
    customColumns.map(
      (column, index) => row[index] ?? ""
    )
  );

  createCustomTable();

  const saveButton = $("saveRecordBtn");

  if (saveButton) {
    saveButton.textContent = "Update Record";
  }

  showPage("recordsPage");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* ================= DELETE RECORD ================= */

async function deleteRecord(id) {
  if (!currentUser) return;

  const confirmed = confirm(
    "Are you sure you want to delete this record?"
  );

  if (!confirmed) return;

  try {
    await consumeUsage("delete");
    await db.runTransaction(async transaction => {
      const profileReference = profileRef();
      const recordReference = recordsRef().doc(id);

      const profileSnapshot =
        await transaction.get(profileReference);

      const recordSnapshot =
        await transaction.get(recordReference);

      if (!recordSnapshot.exists) {
        throw new Error("Record not found.");
      }

      const profile = profileSnapshot.data();

            transaction.delete(recordReference);
    });

    alert("Record deleted successfully.");

    await loadRecords();

  } catch (error) {
    console.error(error);
    alert("Unable to delete record: " + error.message);
  }
}











/* ================= COMPLETE RECORD SEARCH ================= */
function getFilteredRecords() {
  const query = String(searchQuery ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();

  if (!query) return [...records];

  function extractValues(value) {
    if (value === null || value === undefined) return [];

    if (Array.isArray(value)) {
      return value.flatMap(extractValues);
    }

    if (typeof value === "object") {
      return Object.values(value).flatMap(extractValues);
    }

    return [String(value)];
  }

  return records.filter(record => {
    const searchableData = [
      record.title,
      record.date,
      record.note,
      record.details,
      record.fixedFields,
      parseCustomRows(record.customRowsJSON)
    ];

    return searchableData.some(value =>
      extractValues(value)
        .some(text =>
          text.normalize("NFKC")
            .toLowerCase()
            .includes(query)
        )
    );
  });
}

function handleSearch() {
    const searchInput = $("search");
    if (!searchInput) return;

    // Read latest search text
    searchQuery = searchInput.value;

    // Update search results immediately
    renderRecords();

    // Avoid counting the same value twice
    if (searchQuery === lastSearch) return;

    lastSearch = searchQuery;

    // Instant local counter update
    searchOptimisticCount++;

    updateDashboard();

    // Queue Firebase counter updates
    searchCounterQueue = searchCounterQueue
        .then(async () => {
            await consumeUsage("search");

            searchOptimisticCount = Math.max(
                0,
                searchOptimisticCount - 1
            );

            updateDashboard();
        })
        .catch(error => {
            console.error("Search usage error:", error);

            searchOptimisticCount = Math.max(
                0,
                searchOptimisticCount - 1
            );

            updateDashboard();
        });
}

/* ================= RENDER RECORDS + SEARCH STATUS ================= */

function renderRecords() {
  const container = $("recordsContainer");

  if (!container) return;

  const filtered = getFilteredRecords();
 const query = String(searchQuery ?? "");

  container.innerHTML = "";
let resultMessage = "";
let resultColor = "";
  // Search is empty
  if (!query) {
    if (!filtered.length) {
  container.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;">
        No records found.
      </td>

      <td style="
        text-align:center;
        font-weight:bold;
        color:${resultColor};
      ">
        ${escapeHTML(resultMessage)}
      </td>

      <td></td>
    </tr>
  `;
  return;
}
  }

  // Search result message
  

  if (query) {
    if (filtered.length > 0) {
      resultMessage = "Record Found";
      resultColor = "#16a34a";
    } else {
      resultMessage = "Record Not Found";
      resultColor = "#dc2626";
    }
  }

  // If no records found
  if (!filtered.length) {
    container.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;">
          No records found.
        </td>
      </tr>

      <tr>
        <td colspan="4"></td>

        <td style="
          text-align:center;
          font-weight:bold;
          color:${resultColor};
        ">
          ${escapeHTML(resultMessage)}
        </td>

        <td></td>
      </tr>
    `;
    return;
  }

  // Render records
  filtered.forEach((record, index) => {
    const tr = document.createElement("tr");

    // Show message in middle column only once
    const message =
      index === 0 ? resultMessage : "";

    const color =
      index === 0 ? resultColor : "";

    tr.innerHTML = `
      <td>${escapeHTML(record.section || "")}</td>

      <td>${escapeHTML(record.title || "Untitled")}</td>

      <td>${escapeHTML(record.date || "")}</td>

      <td>${escapeHTML(record.fixedFields?.[9] || "-")}</td>

      <td style="
        text-align:center;
        font-weight:bold;
        color:${color};
      ">
        ${escapeHTML(message)}
      </td>

      <td>
        <button type="button"
          onclick="readRecord('${escapeHTML(record.id)}')">
          Read
        </button>

        <button type="button"
          onclick="editRecord('${escapeHTML(record.id)}')">
          Edit
        </button>

        <button type="button"
          onclick="deleteRecord('${escapeHTML(record.id)}')">
          Delete
        </button>
      </td>
    `;

    container.appendChild(tr);
  });
}


/* ================= READ RECORD ================= */


async function readRecord(id) {
  const record = records.find(
    item => item.id === id
  );

  if (!record) {
    alert("Record not found.");
    return;
  }

  try {
    // Read count update
    await consumeUsage("read");

    const panel = $("readRecordContent");
    const container = $("readRecordDetails");

    if (!panel || !container) {
      alert("Read record panel not found.");
      return;
    }

    const labels =
      record.fieldLabels ||
      currentProfile?.fieldLabels ||
      DEFAULT_FIELDS;

    const fixedFields =
      record.fixedFields || {};

    let fixedHTML = "";

    labels.forEach((label, index) => {
      const value = fixedFields[index] ?? "";

      fixedHTML += `
        <div class="read-field">
          <strong>${escapeHTML(label)}:</strong>
          <span>${escapeHTML(value)}</span>
        </div>
      `;
    });

    const columns = record.customColumns || [];

    const rows = parseCustomRows(
      record.customRowsJSON || []
    );

    let tableHTML = "";

    if (columns.length) {
      tableHTML = `
        <div class="read-table-wrapper">
          <table class="read-custom-table">
            <thead>
              <tr>
                ${columns.map(column => `
                  <th>${escapeHTML(column)}</th>
                `).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  ${columns.map((column, index) => `
                    <td>${escapeHTML(row[index] ?? "")}</td>
                  `).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="read-record">
        <h2>${escapeHTML(record.title || "")}</h2>

        <p>
          <strong>Section:</strong>
          ${escapeHTML(record.section || "")}
        </p>

        <p>
          <strong>Date:</strong>
          ${escapeHTML(record.date || "")}
        </p>

        <hr>
        <h3>Fixed Fields</h3>
        ${fixedHTML}

        <hr>
        <h3>Custom Spreadsheet</h3>
        ${tableHTML}

        <hr>
        <h3>Note</h3>
        <p>${escapeHTML(record.note ?? "")}</p>

        <hr>
        <h3>Details</h3>
        <p>${escapeHTML(record.details ?? "")}</p>
      </div>
    `;

    showPage("recordsPage");
    panel.classList.remove("hidden");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {
    alert(error.message);
  }
}



function closeReadRecord() {
  $("readRecordContent")?.classList.add("hidden");

  showPage("recordsPage");
}

/* ================= DASHBOARD ================= */

function updateDashboard() {
  if (!currentProfile) return;

  if ($("dashClinic")) {
    $("dashClinic").textContent =
      currentProfile.clinic || "-";
  }

  if ($("dashRecords")) {
    $("dashRecords").textContent =
      fmt(records.length);
  }

  if ($("dashPackage")) {
    $("dashPackage").textContent =
      getPlanName() +
      " (" +
      getPlanStatusText() +
      ")";
  }

  const end = getPlanEndDate();

  if ($("dashExpiry")) {
    $("dashExpiry").textContent =
      end ? formatDate(end) : "-";
  }

  renderUsage();
}



/* ================= USAGE DISPLAY ================= */

function renderUsage() {
  const container = $("dashboardUsage");

  if (!container) return;

  const plan = currentProfile?.plan;
  const limits = getPlanLimits(plan);

  if (!plan || !limits) {
    container.innerHTML =
      "<p>No active package. Please purchase a package.</p>";
    return;
  }

  const usage = getCurrentUsage();

  // Common card design
  const cardStyle = `
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 12px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    box-sizing: border-box;
  `;

  // Progress bar design
  const progressStyle = `
    width: 100%;
    height: 12px;
    background: #e5e7eb;
    border-radius: 20px;
    overflow: hidden;
    margin: 10px 0;
  `;

  // Characters calculation
  const used = Number(currentProfile?.plan?.usedCharacters || 0);
  const capacity = Number(limits.capacity || 0);

  const remaining = Math.max(0, capacity - used);

  const characterPercent = capacity > 0
    ? Math.min(100, (used / capacity) * 100)
    : 0;

  // Character usage card
  let html = `
    <div style="${cardStyle}">
      <h3>${escapeHTML(plan.name)} Package</h3>

      <p>
        Status:
        <b>${escapeHTML(getPlanStatusText())}</b>
      </p>

      <p>
        Characters:
        <b>${fmt(used)} / ${fmt(capacity)}</b>
      </p>

      <div style="${progressStyle}">
        <div
          style="
            width:${characterPercent}%;
            height:100%;
            background:#16a34a;
            border-radius:20px;
            transition:width 0.3s ease;
          ">
        </div>
      </div>

      <p>
        Remaining Characters:
        <b>${fmt(remaining)}</b>
      </p>

      <p>
        Records:
        <b>${fmt(records.length)}</b>
        (Unlimited count)
      </p>
    </div>

    <h3 style="margin:20px 0 12px;">
      Monthly Usage Limits (${getPeriod()})
    </h3>

    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:12px;
      width:100%;
    ">
  `;

  // Separate card and progress bar for every action
  Object.keys(ACTIONS).forEach(action => {

    const label = ACTIONS[action].label;

    const limit = getActionLimit(action, limits);

    const current = Number(usage[action] || 0);

    const left = Math.max(0, limit - current);

    const percent = limit > 0
      ? Math.min(100, (current / limit) * 100)
      : 0;

    html += `
      <div style="${cardStyle} margin-bottom:0;">

        <h4 style="
          margin:0 0 12px;
          color:#222;
          font-size:16px;
        ">
          ${escapeHTML(label)}
        </h4>

        <p style="margin:5px 0;">
          Used:
          <b>${fmt(current)}</b>
          /
          ${fmt(limit)}
        </p>

        <div style="${progressStyle}">
          <div
            style="
              width:${percent}%;
              height:100%;
              background:#16a34a;
              border-radius:20px;
              transition:width 0.3s ease;
            ">
          </div>
        </div>

        <p style="
          margin:5px 0 0;
          color:#555;
          font-size:13px;
        ">
          Remaining:
          <b>${fmt(left)}</b>
        </p>

      </div>
    `;
  });

  html += `</div>`;

  container.innerHTML = html;
}



/* ================= PACKAGE CARDS ================= */

function renderPackages() {
  const container = $("packageCards");

  if (!container) return;

  container.innerHTML = "";

  Object.values(PACKAGE_LIMITS).forEach(pkg => {
    const div = document.createElement("div");

    div.className = "package-card";

    div.innerHTML = `
      <h3>${escapeHTML(pkg.name)}</h3>

      <h2>Rs. ${fmt(pkg.price)}</h2>

      <p>Duration: ${pkg.days} Days</p>

      <p>Characters: ${fmt(pkg.capacity)}</p>

      <p>Save / Edit: ${fmt(pkg.saveLimit)} / Month</p>

      <p>Searches: ${fmt(pkg.searchLimit)} / Month</p>

      <p>Record Reads: ${fmt(pkg.readLimit)} / Month</p>

      <p>Add Row: ${fmt(pkg.saveLimit)} / Month</p>

      <p>Add Column: ${fmt(pkg.saveLimit)} / Month</p>

      <p>Delete Row: ${fmt(pkg.saveLimit)} / Month</p>

      <p>Delete Column: ${fmt(pkg.saveLimit)} / Month</p>

      <p>Unlimited Record Count</p>

      <button
        type="button"
        onclick="requestPackage('${pkg.name}')">
        Request Package
      </button>
    `;

    container.appendChild(div);
  });

  renderRequests();
}


/* ================= PACKAGE REQUEST STATUS HELPER ================= */

function isPlanApprovedAndActive(plan) {
  if (!plan || plan.status !== "approved") {
    return false;
  }

  const end = parseDate(
    plan.endAt || plan.endDate
  );

  return Boolean(
    end && end.getTime() >= Date.now()
  );
}



/* ================= PACKAGE REQUESTS ================= */

let selectedPackageForPayment = null;
let isSubmittingPackageRequest = false;

// Open payment popup
function requestPackage(name) {
  const pkg = PACKAGE_LIMITS[name];

  if (!pkg) {
    alert("Invalid package.");
    return;
  }

  selectedPackageForPayment = pkg;

  $("paymentPackageName").textContent =
    pkg.name + " Package";

  $("paymentPackagePrice").textContent =
    "Rs. " + fmt(pkg.price);

  // Clear previous payment details
  $("paymentSenderName").value = "";
  $("paymentTransactionId").value = "";

  $("packagePaymentPopup").classList.remove("hidden");
}


// Close payment popup
function closePackagePayment() {
  $("packagePaymentPopup").classList.add("hidden");
}



// Submit package request
async function confirmPackageRequest() {

  const pkg = selectedPackageForPayment;

  if (!pkg) {
    alert("Please select a package first.");
    return;
  }

  if (isSubmittingPackageRequest) return;

  // Get ORIGINAL input values.
  // Do NOT use trim(), because spaces must count.
  const paymentSenderName =
    $("paymentSenderName").value;

  const paymentTransactionId =
    $("paymentTransactionId").value;

  // Required field validation.
  if (paymentSenderName.length === 0) {
    alert("Please enter Payment Sender Name.");
    $("paymentSenderName").focus();
    return;
  }

  if (paymentTransactionId.length === 0) {
    alert("Please enter Transaction ID (TRX ID).");
    $("paymentTransactionId").focus();
    return;
  }

  // Character limits.
  if (countTextCharacters(paymentSenderName) > 100) {
    alert("Payment Sender Name cannot exceed 100 characters.");
    return;
  }

  if (countTextCharacters(paymentTransactionId) > 150) {
    alert("Transaction ID cannot exceed 150 characters.");
    return;
  }

  // Count BOTH fields.
  // Spaces, Urdu, English and symbols included.
  const requestCharacters =
    countTextCharacters(paymentSenderName) +
    countTextCharacters(paymentTransactionId);

  const submitButton = $("submitPackageRequestBtn");

  isSubmittingPackageRequest = true;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }

  try {

    const profileReference = userRef();
    const requestReference = requestsRef().doc();

    await db.runTransaction(async transaction => {

      const snap = await transaction.get(profileReference);

      if (!snap.exists) {
        throw new Error("Profile not found.");
      }

      const profile = snap.data();

      // Check whether existing package is active.
      const activePlan =
        isPlanApprovedAndActive(profile.plan);

      let state = null;
      let newUsedCharacters = null;

      if (activePlan) {

        // Monthly action counter.
        state = getUsageState(profile.plan);

        checkActionLimit(
          "packageRequest",
          state.usage,
          profile.plan
        );

        state.usage.packageRequest++;

        // Existing Firebase character usage.
        const oldUsedCharacters = Math.max(
          0,
          Number(profile.plan.usedCharacters || 0)
        );

        // Add package request characters.
        newUsedCharacters =
          oldUsedCharacters + requestCharacters;

        // Check package character capacity.
        const capacity = Number(
          profile.plan.capacity || 0
        );

        if (
          capacity > 0 &&
          newUsedCharacters > capacity
        ) {
          throw new Error(
            "Package character capacity exceeded. " +
            "Used: " + oldUsedCharacters +
            ", Request Characters: " + requestCharacters +
            ", Capacity: " + capacity
          );
        }
      }

      // Save package request.
      transaction.set(requestReference, {

        uid: currentUser.uid,
        email: currentUser.email,

        clinic: profile.clinic || "",
        owner: profile.owner || "",

        packageName: pkg.name,
        price: pkg.price,
        days: pkg.days,
        capacity: pkg.capacity,

        saveLimit: pkg.saveLimit,
        searchLimit: pkg.searchLimit,
        readLimit: pkg.readLimit,

        addRowLimit: pkg.saveLimit,
        addColumnLimit: pkg.saveLimit,
        deleteRowLimit: pkg.saveLimit,
        deleteColumnLimit: pkg.saveLimit,

        // Original payment details.
        paymentSenderName: paymentSenderName,
        paymentTransactionId: paymentTransactionId,

        // Permanent character record for this request.
        requestCharacters: requestCharacters,

        // Whether characters were charged to an active plan.
        charactersCounted: activePlan,

        status: "pending",
        createdAt: SERVER_TIME()
      });

      // Update Firebase counters ONLY for active package.
      if (activePlan && state) {

        transaction.update(profileReference, {

          "plan.usedCharacters": newUsedCharacters,

          "plan.usage": state.usage,

          "plan.usagePeriod": state.period

        });

      }

    });

    // Refresh Firebase profile.
    const refreshed = await userRef().get();

    if (refreshed.exists) {
      currentProfile = refreshed.data();
    }

    // Clear fields after successful submission.
    $("paymentSenderName").value = "";
    $("paymentTransactionId").value = "";

    closePackagePayment();

    alert(
      "Package request submitted successfully.\n\n" +
      "Characters counted: " + requestCharacters +
      (isPlanApprovedAndActive(currentProfile.plan)
        ? "\nCharacters permanently added to package usage."
        : "\nNo active package character usage was charged.")
    );

    // Refresh dashboard and package display.
    updateDashboard();
    renderUsage();
    renderPackages();
    renderRequests();
    renderReports();

  } catch (error) {

    console.error("Package Request Error:", error);

    alert(
      "Package request failed: " + error.message
    );

  } finally {

    isSubmittingPackageRequest = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Main Submit Package";
    }

  }
}





function loadRequests() {
  if (requestUnsubscribe) {
    requestUnsubscribe();
  }

  requestUnsubscribe = requestsRef()
    .orderBy("createdAt", "desc")
    .onSnapshot(
      snapshot => {
        requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        renderRequests();
        populateMessageRequests();
        renderReports();
      },
      error => console.error(error)
    );
}


function renderRequests() {
  const container = $("myRequests");

  if (!container) return;

  if (!requests.length) {
    container.innerHTML =
      "<p>No package requests.</p>";

    return;
  }

  container.innerHTML = requests.map(request => `
    <div class="usage-card">
      <h3>${escapeHTML(request.packageName)}</h3>

      <p>Price: Rs. ${fmt(request.price)}</p>

      <p>Characters: ${fmt(request.capacity)}</p>

      <p>Save Limit: ${fmt(request.saveLimit)}</p>

      <p>Search Limit: ${fmt(request.searchLimit)}</p>

      <p>Read Limit: ${fmt(request.readLimit)}</p>

      <p>Add Row Limit: ${fmt(request.addRowLimit ?? request.saveLimit)}</p>

      <p>Add Column Limit: ${fmt(request.addColumnLimit ?? request.saveLimit)}</p>

      <p>Delete Row Limit: ${fmt(request.deleteRowLimit ?? request.saveLimit)}</p>

      <p>Delete Column Limit: ${fmt(request.deleteColumnLimit ?? request.saveLimit)}</p>

      <p>Status:
        <b>${escapeHTML(request.status)}</b>
      </p>

      <p>Date: ${formatDate(request.createdAt)}</p>
    </div>
  `).join("");
}


/* ================= SUPPORT MESSAGES ================= */

function loadMessages() {
  if (messageUnsubscribe) {
    messageUnsubscribe();
  }

  messageUnsubscribe = messagesRef()
    .orderBy("createdAt", "asc")
    .onSnapshot(
      snapshot => {
        messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        populateMessageRequests();
        renderMessages();
      },
      error => console.error(error)
    );
}


function populateMessageRequests() {
  const select = $("messageRequest");

  if (!select) return;

  const old = select.value;

  select.innerHTML =
    "<option value=''>Select Request</option>";

  requests.forEach(request => {
    const option = document.createElement("option");

    option.value = request.id;

    option.textContent =
      request.packageName +
      " - " +
      request.status;

    select.appendChild(option);
  });

  select.value = old;
}


function renderMessages() {
  const container = $("messageConversation");

  if (!container) return;

  const requestId = $("messageRequest").value;

  const filtered = messages.filter(message =>
    !requestId ||
    message.requestId === requestId
  );

  if (!filtered.length) {
    container.innerHTML =
      "<p>No messages yet.</p>";

    return;
  }

  container.innerHTML = filtered.map(message => `
    <div class="message-item">
      <b>${escapeHTML(message.sender || "Support")}</b>

      <p>${escapeHTML(message.text)}</p>

      <small>${formatDate(message.createdAt)}</small>
    </div>
  `).join("");

  container.scrollTop =
    container.scrollHeight;
}


async function sendMessage() {
  const text = $("messageText").value.trim();
  const requestId = $("messageRequest").value;

  if (!requestId) {
    alert("Select a package request first.");
    return;
  }

  if (!text) {
    alert("Enter your message.");
    return;
  }

  try {
    const profileRef = userRef();
    const messageRef = messagesRef().doc();

    await db.runTransaction(
      async transaction => {
        const snap =
          await transaction.get(profileRef);

        if (!snap.exists) {
          throw new Error("Profile not found.");
        }

        const profile = snap.data();
        const state = getUsageState(profile.plan);

        validatePlan(profile.plan);

        checkActionLimit(
          "supportMessage",
          state.usage,
          profile.plan
        );

        state.usage.supportMessage++;
const messageCharacters =
  countTextCharacters(text);

const currentUsed = Number(
  profile.plan.usedCharacters || 0
);

const capacity = Number(
  profile.plan.capacity || 0
);

const newUsed =
  currentUsed + messageCharacters;

if (capacity > 0 && newUsed > capacity) {
  throw new Error(
    "Package character capacity exceeded. Remaining: " +
    fmt(Math.max(0, capacity - currentUsed))
  );
}
        transaction.set(messageRef, {
          requestId,
          text,
          sender: "User",
          uid: currentUser.uid,
          createdAt: SERVER_TIME()
        });

        transaction.update(profileRef, {
  "plan.usage": state.usage,
  "plan.usagePeriod": state.period,
  "plan.usedCharacters": newUsed
});
      }
    );

    $("messageText").value = "";

    const refreshed = await userRef().get();

    if (refreshed.exists) {
      currentProfile = refreshed.data();
    }

    alert("Message sent successfully.");

    updateDashboard();

  } catch (error) {
    alert(error.message);
  }
}


/* ================= REPORTS ================= */

function renderReports() {
  const tbody = $("reportTableBody");

  if (!tbody) return;

  const groups = {};

  records.forEach(record => {
    const section =
      record.section || "Other Records";

    if (!groups[section]) {
      groups[section] = {
        count: 0,
        characters: 0
      };
    }

    groups[section].count++;

    groups[section].characters +=
      calculateRecordCharacters(record);
  });

  tbody.innerHTML =
    Object.entries(groups).map(
      ([section, data]) => `
        <tr>
          <td>${escapeHTML(section)}</td>
          <td>${fmt(data.count)}</td>
          <td>${fmt(data.characters)}</td>
        </tr>
      `
    ).join("");

  if (!Object.keys(groups).length) {
    tbody.innerHTML =
      "<tr><td colspan='3'>No records.</td></tr>";
  }

  const plan = currentProfile?.plan;
  const usage = getCurrentUsage();
  const limits = getPlanLimits(plan);

  const report = $("requestUsageReport");

  if (!report) return;

  if (!plan || !limits) {
    report.innerHTML =
      "<p>No package information available.</p>";

    return;
  }

  const actionRows = Object.keys(ACTIONS)
    .map(action => {
      const limit =
        getActionLimit(action, limits);

      const current =
        Number(usage[action] || 0);

      return `
        <tr>
          <td>${escapeHTML(ACTIONS[action].label)}</td>
          <td>${fmt(current)}</td>
          <td>${fmt(limit)}</td>
          <td>${fmt(Math.max(0, limit - current))}</td>
        </tr>
      `;
    }).join("");

  report.innerHTML = `
    <div class="usage-card">
      <h3>Package Usage Report</h3>

      <p>Package: ${escapeHTML(getPlanName())}</p>

      <p>Status: ${escapeHTML(getPlanStatusText())}</p>

      <p>
        Character Usage:
        ${fmt(plan.usedCharacters)} /
        ${fmt(limits.capacity)}
      </p>

      <p>Total Records: ${fmt(records.length)}</p>

      <h4>Monthly Action Usage</h4>

      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Used</th>
            <th>Total</th>
            <th>Remaining</th>
          </tr>
        </thead>

        <tbody>
          ${actionRows}
        </tbody>
      </table>
    </div>
  `;
}


/* ================= FAST DIRECT PRINT ================= */

async function printCurrent() {
  if (!records.length) {
    alert("No records available to print.");
    return;
  }

  try {
    await consumeUsage("print");

    const printArea = $("printArea");

    if (!printArea) {
      throw new Error("Print area not found.");
    }

    const html = records.map(record => `
      <div class="print-record">

        <h2>${escapeHTML(record.title || "")}</h2>

        <p>
          <b>Section:</b>
          ${escapeHTML(record.section || "")}
        </p>

        <p>
          <b>Date:</b>
          ${escapeHTML(record.date || "")}
        </p>

        <hr>

        ${Object.entries(record.fixedFields || {})
          .map(([key, value]) => `
            <p>
              <b>
                ${escapeHTML(
                  record.fieldLabels?.[key] ||
                  DEFAULT_FIELDS[key] ||
                  key
                )}:
              </b>
              ${escapeHTML(value)}
            </p>
          `).join("")}

        ${(record.customColumns || [])
          .map((column, index) => {
            const rows = parseCustomRows(
              record.customRowsJSON
            );

            const values = rows
              .map(row => row[index] ?? "")
              .filter(Boolean);

            return `
              <p>
                <b>${escapeHTML(column)}:</b>
                ${escapeHTML(values.join(", "))}
              </p>
            `;
          }).join("")}

        <p>
          <b>Note:</b>
          ${escapeHTML(record.note ?? "")}
        </p>

        <p>
          <b>Details:</b>
          ${escapeHTML(record.details ?? "")}
        </p>

      </div>
    `).join("");

    printArea.innerHTML = html;

    window.print();

  } catch (error) {
    alert(error.message);
  }
}


/* ================= TXT BACKUP ================= */

async function backupTXT() {
  try {
    await consumeUsage("backup");

    const backup = {
      app: "MediMax",
      version: "3.0",
      createdAt: new Date().toISOString(),
      clinic: currentProfile.clinic || "",

      records: records
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      {
        type: "application/json"
      }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
      "MediMax-Backup-" +
      new Date().toISOString().slice(0, 10) +
      ".txt";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

  } catch (error) {
    alert(error.message);
  }
}


function backupTxt() {
  return backupTXT();
}


/* ================= RESTORE BACKUP ================= */

async function restoreTXT() {
  if (isRestoring) return;

  const file = $("restoreFile")?.files[0];

  if (!file) {
    alert("Select a backup file first.");
    return;
  }

  if (!confirm("Restore records from backup?")) {
    return;
  }

  isRestoring = true;

  const BATCH_SIZE = 400;
  let restoredCount = 0;
  let totalRecords = 0;

  const progress = $("restoreProgress");

  function updateRestoreProgress(message) {
    if (progress) {
      progress.textContent = message;
    }
  }

  try {
    updateRestoreProgress("Reading backup file...");

    const content = await file.text();
    const parsed = JSON.parse(content);

    const backupRecords = Array.isArray(parsed)
      ? parsed
      : parsed.records;

    if (!Array.isArray(backupRecords)) {
      throw new Error("Invalid backup format.");
    }

    if (!backupRecords.length) {
      throw new Error("Backup contains no records.");
    }

    // Validate all records before starting restore.
    backupRecords.forEach((record, index) => {
      if (
        !record ||
        typeof record !== "object" ||
        Array.isArray(record)
      ) {
        throw new Error(
          "Invalid record found at position " + (index + 1)
        );
      }
    });

    totalRecords = backupRecords.length;

    // Normalize backup records.
    const cleanRecords = backupRecords.map(record => ({
      section: record.section || "Other Records",

      title: record.title ?? "Restored Record",

      date: record.date || "",

      fieldLabels:
        Array.isArray(record.fieldLabels)
          ? record.fieldLabels
          : [...DEFAULT_FIELDS],

      fixedFields:
        record.fixedFields &&
        typeof record.fixedFields === "object" &&
        !Array.isArray(record.fixedFields)
          ? record.fixedFields
          : {},

      customColumns:
        Array.isArray(record.customColumns)
          ? record.customColumns
          : [],

      customRowsJSON: JSON.stringify(
        parseCustomRows(
          record.customRowsJSON || []
        )
      ),

      note: record.note ?? "",

      details: record.details ?? "",

      createdAt: SERVER_TIME(),

      updatedAt: SERVER_TIME()
    }));

    // Restore in multiple Firestore transactions.
    const totalBatches = Math.ceil(
      cleanRecords.length / BATCH_SIZE
    );

    for (
      let batchIndex = 0;
      batchIndex < totalBatches;
      batchIndex++
    ) {
      const start = batchIndex * BATCH_SIZE;

      const batchRecords = cleanRecords.slice(
        start,
        start + BATCH_SIZE
      );

      const batchCharacters = batchRecords.reduce(
        (sum, record) =>
          sum + calculateRecordCharacters(record),
        0
      );

      // Create Firestore references for this batch.
      const batchRefs = batchRecords.map(() =>
        recordsRef().doc()
      );

      const profileReference = userRef();

      updateRestoreProgress(
        "Restoring batch " +
        (batchIndex + 1) +
        " of " +
        totalBatches +
        "..."
      );

      await db.runTransaction(async transaction => {
        const profileSnap =
          await transaction.get(profileReference);

        if (!profileSnap.exists) {
          throw new Error("Profile not found.");
        }

        const profile = profileSnap.data();
        const plan = profile.plan;

        validatePlan(plan);

        const state = getUsageState(plan);

        // Count Restore action only once
        // for the complete restore operation.
        if (batchIndex === 0) {
          checkActionLimit(
            "restore",
            state.usage,
            plan
          );

          state.usage.restore++;
        }

        const limits = getPlanLimits(plan);

        const currentUsed = Number(
          plan.usedCharacters || 0
        );

        const newUsed =
          currentUsed + batchCharacters;

        if (newUsed > limits.capacity) {
          throw new Error(
            "Character capacity exceeded. Remaining: " +
            fmt(
              Math.max(
                0,
                limits.capacity - currentUsed
              )
            )
          );
        }

        // Save this batch.
        batchRecords.forEach((record, index) => {
          transaction.set(
            batchRefs[index],
            record
          );
        });

        // Update character usage and monthly counter.
        transaction.update(profileReference, {
          "plan.usedCharacters": newUsed,
          "plan.usage": state.usage,
          "plan.usagePeriod": state.period
        });
      });

      // Count records only after successful batch.
      restoredCount += batchRecords.length;

      updateRestoreProgress(
        "Restored " +
        fmt(restoredCount) +
        " / " +
        fmt(totalRecords) +
        " records"
      );
    }

    const refreshed = await userRef().get();

    if (refreshed.exists) {
      currentProfile = refreshed.data();
    }

    $("restoreFile").value = "";

    updateDashboard();
    renderReports();

    updateRestoreProgress(
      "Restore completed successfully: " +
      fmt(restoredCount) +
      " records."
    );

    alert(
      "Backup restored successfully.\n" +
      "Total records restored: " +
      fmt(restoredCount)
    );

  } catch (error) {
    console.error("Restore Error:", error);

    const message =
      "Restore failed: " +
      error.message +
      "\nSuccessfully restored: " +
      fmt(restoredCount) +
      " / " +
      fmt(totalRecords) +
      " records.";

    updateRestoreProgress(message);

    // Refresh profile if some batches were already saved.
    if (restoredCount > 0) {
      try {
        const refreshed = await userRef().get();

        if (refreshed.exists) {
          currentProfile = refreshed.data();
        }

        updateDashboard();
        renderReports();

      } catch (refreshError) {
        console.error(refreshError);
      }
    }

    alert(message);

  } finally {
    isRestoring = false;
  }
}

document.getElementById("copyEasyPaisaBtn").addEventListener("click", async function () {
    const accountNumber = document.getElementById("EasyPaisaNumber").textContent.trim();
    const toast = document.getElementById("copyToast");

    try {
        await navigator.clipboard.writeText(accountNumber);

        toast.textContent = "Copied!";
        toast.style.display = "block";

        setTimeout(() => {
            toast.style.display = "none";
        }, 1500);

    } catch (error) {
        const tempInput = document.createElement("textarea");
        tempInput.value = accountNumber;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        tempInput.remove();

        toast.textContent = "Copied!";
        toast.style.display = "block";

        setTimeout(() => {
            toast.style.display = "none";
        }, 1500);
    }
});
/* ================= END OF MEDIMAX APP.JS ================= */