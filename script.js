// Global variables
let labPrices = []; // To store test codes, names, and their private/tourist prices
let labDetails = {}; // ACTIVE details book (alias -> points to the selected branch's book)
let labDetailsRamatHahayal = {}; // Ramat HaHayal test book
let labDetailsHaifa = {}; // Haifa test book
let currentPriceType = "private"; // Default price type
let currentBranch = "ramat_hahayal"; // Default branch (preserves original behavior)
let selectedLabTests = []; // Array to store currently selected lab tests

// Branch registry: display labels only. Prices and PDF contact details are identical across branches.
const BRANCHES = {
    ramat_hahayal: { label: "רמת החייל" },
    haifa: { label: "חיפה" }
};

// Keep the active-book alias in sync with the selected branch.
function applyActiveBranchDetails() {
    labDetails = (currentBranch === "haifa") ? labDetailsHaifa : labDetailsRamatHahayal;
}

// Per-branch ordered detail fields (JSON key -> display label). Ramat HaHayal keeps its
// original 6 fields; Haifa shows the columns requested from the Haifa book (C,D,H,I,J,M,O,P,Q,R).
const BRANCH_DETAIL_FIELDS = {
    ramat_hahayal: [
        { key: "patient_preparation_conditions", label: "תנאים והכנת החולה לפני הדיגום" },
        { key: "tubes", label: "מבחנות נדרשות" },
        { key: "sampling_conditions", label: "תנאי לקיחה ושימור" },
        { key: "transport_instructions", label: "הוראות שינוע" },
        { key: "execution_time_info", label: "מידע על זמן ביצוע" },
        { key: "results_time", label: "משך זמן לקבלת תשובה", suffix: " (ימי עבודה)" }
    ],
    haifa: [
        { key: "test_name_book", label: "שם הבדיקה" },
        { key: "code_tfnit", label: "קוד תפנית" },
        { key: "patient_preparation_conditions", label: "תנאים פרה אנליטיים (דרישות מיוחדות)" },
        { key: "sampling_conditions", label: "תנאי לקיחה" },
        { key: "tubes", label: "כלי קיבול לדגימה / מבחנה / צנצנת" },
        { key: "execution_time_info", label: "זמן מירבי מדיגום עד הגעה למעבדה" },
        { key: "performing_lab", label: "מעבדה מבצעת" },
        { key: "results_time", label: "משך הזמן עד הוצאת תשובה (ימי עבודה)" },
        { key: "storage_conditions", label: "תנאי שימור וטיפול בדגימה" },
        { key: "transport_instructions", label: "תנאי שינוע" }
    ]
};

// Build the <p> detail rows for the active branch's field set.
function renderDetailRows(details) {
    const fields = BRANCH_DETAIL_FIELDS[currentBranch] || BRANCH_DETAIL_FIELDS.ramat_hahayal;
    return fields
        .map(f => `<p><strong>${f.label}:</strong> ${details[f.key] || "לא צוין"}${f.suffix || ""}</p>`)
        .join("\n                ");
}

// Escape user-facing data before injecting via innerHTML.
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// One test row: code – name – price, each isolated with <bdi> so RTL/LTR mixing can't
// reorder it and the price stays glued to "ש"ח". priceText is already formatted.
function formatTestLine(test, priceText) {
    return `(<bdi>${escapeHtml(test.test_code)}</bdi>) - <bdi>${escapeHtml(test.test_name)}</bdi> - <bdi>${priceText} ש"ח</bdi>`;
}

// Base prices for nurse visit
const NURSE_VISIT_BASE_PRICE_PRIVATE = 710;
const NURSE_VISIT_BASE_PRICE_TOURIST = 860;

function getCurrentNurseBasePrice() {
    return currentPriceType === "tourist" ? NURSE_VISIT_BASE_PRICE_TOURIST : NURSE_VISIT_BASE_PRICE_PRIVATE;
}

document.addEventListener("DOMContentLoaded", async () => {
    // DOM Elements
    const priceListSelect = document.getElementById("priceListSelect");
    const branchSelect = document.getElementById("branchSelect");
    const detailsBranchLabel = document.getElementById("detailsBranchLabel");

    const nurseVisitBasePriceSpan = document.getElementById("nurseBasePrice");

    const testSearchInput = document.getElementById("testSearch");
    const searchResultsDiv = document.getElementById("testSuggestions");
    const selectedTestsUl = document.getElementById("selectedTestsList");
    const labTestsSubtotalSpan = document.getElementById("labTestsSubtotal");

    const testDetailsContentDiv = document.getElementById("testDetailsContent");

    const summaryNursePriceSpan = document.getElementById("summaryNursePrice");
    const summaryLabTestsPriceSpan = document.getElementById("summaryLabTestsPrice");
    const finalPriceSpan = document.getElementById("finalAmount");

    const toggleBaseDiscountBtn = document.getElementById("toggleBaseDiscountBtn");
    const baseDiscountContainer = document.getElementById("baseDiscountContainer");
    const baseDiscountInput = document.getElementById("basePackageDiscount");

    const exportPdfButton = document.getElementById("exportPdfButton");
    const exportStaffPdfButton = document.getElementById("exportStaffPdfButton");
    const clearAllBtn = document.getElementById("clearAllBtn");

    // Search keyboard-navigation state
    let currentMatches = [];
    let activeIndex = -1;

    const STORAGE_KEY = "labPriceCalcState_v1";

    // --- Initialization ---
    async function initializeApp() {
        console.log("Initializing app...");
        await Promise.all([
            loadLabPrices(),
            loadLabDetails(),
            loadLabDetailsHaifa()
        ]);
        loadState();
        applyActiveBranchDetails();
        renderSelectedTests();
        if (selectedLabTests.length > 0) {
            displayTestDetails(selectedLabTests[selectedLabTests.length - 1].test_code);
        }
        updateCalculations();
    }

    // --- State persistence (localStorage) ---
    function saveState() {
        try {
            const state = {
                branch: currentBranch,
                priceType: currentPriceType,
                codes: selectedLabTests.map(t => String(t.test_code)),
                discountOpen: baseDiscountContainer ? !baseDiscountContainer.classList.contains("hidden") : false,
                discountValue: baseDiscountInput ? baseDiscountInput.value : 0
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            // localStorage unavailable (private mode / disabled) — ignore, app still works.
        }
    }

    function loadState() {
        let state;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            state = JSON.parse(raw);
        } catch (e) {
            return;
        }
        if (!state) return;

        if (state.branch && BRANCHES[state.branch]) {
            currentBranch = state.branch;
            if (branchSelect) branchSelect.value = state.branch;
            if (detailsBranchLabel) detailsBranchLabel.textContent = BRANCHES[currentBranch].label;
        }
        if (state.priceType) {
            currentPriceType = state.priceType;
            if (priceListSelect) priceListSelect.value = state.priceType;
        }
        if (Array.isArray(state.codes)) {
            // Re-resolve from the current price list so prices stay up to date.
            selectedLabTests = state.codes
                .map(code => labPrices.find(t => String(t.test_code) === String(code)))
                .filter(Boolean);
        }
        if (baseDiscountContainer && baseDiscountInput) {
            if (state.discountOpen) {
                baseDiscountContainer.classList.remove("hidden");
                baseDiscountInput.value = state.discountValue || 0;
            } else {
                baseDiscountContainer.classList.add("hidden");
                baseDiscountInput.value = 0;
            }
        }
    }

    // --- Data Loading Functions ---
    async function loadLabPrices() {
        const jsonPath = "assets/data/lab_prices.json";
        try {
            const response = await fetch(jsonPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            labPrices = await response.json();
            console.log("Lab prices loaded successfully:", labPrices.length, "items");
            if (labPrices.length === 0) {
                if(searchResultsDiv) searchResultsDiv.innerHTML = 
                    `<p style=\"color: red;\">קובץ מחירי הבדיקות נטען אך הוא ריק.</p>`;
            }
        } catch (error) {
            console.error("Error loading lab prices:", error);
            if(searchResultsDiv) searchResultsDiv.innerHTML = 
                `<p style=\"color: red;\">שגיאה בטעינת מחירי הבדיקות: ${error.message}.</p>`;
        }
    }

    async function loadLabDetails() {
        const jsonPath = "assets/data/lab_details.json";
        try {
            const response = await fetch(jsonPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            labDetailsRamatHahayal = await response.json();
            console.log("Ramat HaHayal details loaded. Entries:", Object.keys(labDetailsRamatHahayal).length);
        } catch (error) {
            console.error("Error loading Ramat HaHayal details:", error);
            if(testDetailsContentDiv) testDetailsContentDiv.innerHTML =
                `<p style=\"color: red;\">שגיאה בטעינת פרטי הבדיקות: ${error.message}.</p>`;
        }
    }

    async function loadLabDetailsHaifa() {
        const jsonPath = "assets/data/lab_details_haifa.json";
        try {
            const response = await fetch(jsonPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            labDetailsHaifa = await response.json();
            console.log("Haifa details loaded. Entries:", Object.keys(labDetailsHaifa).length);
        } catch (error) {
            // Non-fatal: leave the Haifa book empty so its tests fall back to "no details".
            // Do NOT clobber the details panel — the default Ramat HaHayal branch must stay clean.
            console.error("Error loading Haifa details:", error);
        }
    }

    // --- Event Listeners ---
    if (priceListSelect) priceListSelect.addEventListener("change", (event) => {
        currentPriceType = event.target.value;
        updateCalculations();
        renderSelectedTests();
        saveState();
    });

    // Branch selector: switches the active details book only (prices/selection are unaffected).
    if (branchSelect) branchSelect.addEventListener("change", (event) => {
        currentBranch = event.target.value;
        applyActiveBranchDetails();
        if (detailsBranchLabel) detailsBranchLabel.textContent = BRANCHES[currentBranch].label;
        if (selectedLabTests.length > 0) {
            displayTestDetails(selectedLabTests[selectedLabTests.length - 1].test_code);
        } else if (testDetailsContentDiv) {
            testDetailsContentDiv.innerHTML = "<p>בחר בדיקה מהרשימה כדי לראות את פרטיה.</p>";
        }
        saveState();
    });

    // Base Package Discount Toggle Button
    if (toggleBaseDiscountBtn) toggleBaseDiscountBtn.addEventListener("click", () => {
        baseDiscountContainer.classList.toggle("hidden");
        if (baseDiscountContainer.classList.contains("hidden")) baseDiscountInput.value = 0;
        updateCalculations();
        saveState();
    });

    if (testSearchInput) testSearchInput.addEventListener("input", handleSearch);
    if (testSearchInput) testSearchInput.addEventListener("keydown", handleSearchKeydown);
    if (baseDiscountInput) baseDiscountInput.addEventListener("input", () => { updateCalculations(); saveState(); });
    if (exportPdfButton) exportPdfButton.addEventListener("click", generateQuotePdfViaPrint);
    if (exportStaffPdfButton) exportStaffPdfButton.addEventListener("click", generateStaffPdfViaPrint);
    if (clearAllBtn) clearAllBtn.addEventListener("click", clearAll);

    // Close the suggestions when clicking outside the search box.
    document.addEventListener("click", (event) => {
        if (!searchResultsDiv) return;
        if (!searchResultsDiv.contains(event.target) && event.target !== testSearchInput) {
            closeSuggestions();
        }
    });

    // --- Search and Selection Logic ---
    function closeSuggestions() {
        if (!searchResultsDiv) return;
        searchResultsDiv.innerHTML = "";
        searchResultsDiv.classList.remove("active");
        currentMatches = [];
        activeIndex = -1;
    }

    function highlightActive() {
        if (!searchResultsDiv) return;
        const items = searchResultsDiv.querySelectorAll("li");
        items.forEach((li, i) => {
            if (i === activeIndex) {
                li.classList.add("active-suggestion");
                li.scrollIntoView({ block: "nearest" });
            } else {
                li.classList.remove("active-suggestion");
            }
        });
    }

    function handleSearch() {
        if (!testSearchInput || !searchResultsDiv) return;
        const query = testSearchInput.value.toLowerCase().trim();
        searchResultsDiv.innerHTML = "";
        activeIndex = -1;
        currentMatches = [];
        if (query.length < 1) {
            searchResultsDiv.classList.remove("active");
            return;
        }
        if (!labPrices || labPrices.length === 0) {
            searchResultsDiv.innerHTML = `<p style=\"color: orange;\">מחירי הבדיקות בטעינה או שלא נטענו.</p>`;
            searchResultsDiv.classList.add("active");
            return;
        }
        const filteredTests = labPrices.filter(test =>
            (test.test_name && test.test_name.toLowerCase().includes(query)) ||
            (test.test_code && String(test.test_code).toLowerCase().includes(query))
        );
        if (filteredTests.length > 0) {
            currentMatches = filteredTests.slice(0, 15);
            const ul = document.createElement("ul");
            currentMatches.forEach((test, i) => {
                const li = document.createElement("li");
                const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
                li.innerHTML = formatTestLine(test, formatPrice(price));
                li.addEventListener("click", () => addTestToSelected(test));
                li.addEventListener("mousemove", () => { activeIndex = i; highlightActive(); });
                ul.appendChild(li);
            });
            searchResultsDiv.appendChild(ul);
            searchResultsDiv.classList.add("active");
        } else {
            searchResultsDiv.innerHTML = "<p>לא נמצאו בדיקות תואמות.</p>";
            searchResultsDiv.classList.add("active");
        }
    }

    function handleSearchKeydown(event) {
        if (event.key === "Escape") {
            closeSuggestions();
            return;
        }
        if (!currentMatches.length) return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeIndex = Math.min(activeIndex + 1, currentMatches.length - 1);
            highlightActive();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            highlightActive();
        } else if (event.key === "Enter") {
            if (activeIndex >= 0 && activeIndex < currentMatches.length) {
                event.preventDefault();
                addTestToSelected(currentMatches[activeIndex]);
            }
        }
    }

    function addTestToSelected(test) {
        if (!selectedLabTests.find(t => String(t.test_code) === String(test.test_code))) {
            selectedLabTests.push(test);
            renderSelectedTests();
            updateCalculations();
            displayTestDetails(test.test_code);
            saveState();
        }
        if (testSearchInput) testSearchInput.value = "";
        closeSuggestions();
    }

    function removeTestFromSelected(testCode) {
        selectedLabTests = selectedLabTests.filter(t => String(t.test_code) !== String(testCode));
        renderSelectedTests();
        updateCalculations();
        if (testDetailsContentDiv && selectedLabTests.length === 0) {
            testDetailsContentDiv.innerHTML = "<p>בחר בדיקה מהרשימה כדי לראות את פרטיה.</p>";
        } else if (selectedLabTests.length > 0) {
            displayTestDetails(selectedLabTests[selectedLabTests.length -1].test_code);
        } else {
             testDetailsContentDiv.innerHTML = "<p>בחר בדיקה מהרשימה כדי לראות את פרטיה.</p>";
        }
        saveState();
    }

    // Reset selected tests + base discount (branch/price-list settings are kept).
    function clearAll() {
        selectedLabTests = [];
        if (baseDiscountContainer) baseDiscountContainer.classList.add("hidden");
        if (baseDiscountInput) baseDiscountInput.value = 0;
        if (testSearchInput) testSearchInput.value = "";
        closeSuggestions();
        renderSelectedTests();
        updateCalculations();
        if (testDetailsContentDiv) {
            testDetailsContentDiv.innerHTML = "<p>בחר בדיקה מהרשימה כדי לראות את פרטיה.</p>";
        }
        saveState();
    }

    function renderSelectedTests() {
        if (clearAllBtn) clearAllBtn.classList.toggle("hidden", selectedLabTests.length === 0);
        if (!selectedTestsUl) return;
        selectedTestsUl.innerHTML = "";
        selectedLabTests.forEach(test => {
            const li = document.createElement("li");
            const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
            li.innerHTML = `<span class="selected-test-info" dir="rtl">${formatTestLine(test, formatPrice(price))}</span>`
                + `<button class=\"remove-btn\" data-code=\"${test.test_code}\">הסר</button>`;
            li.addEventListener("click", (e) => {
                if (!e.target.classList.contains("remove-btn")) {
                     displayTestDetails(test.test_code);
                }
            });
            const removeButton = li.querySelector(".remove-btn");
            if (removeButton) {
                removeButton.addEventListener("click", () => removeTestFromSelected(test.test_code));
            }
            selectedTestsUl.appendChild(li);
        });
    }

    function displayTestDetails(testCode) {
        if (!testDetailsContentDiv || !labDetails || !labPrices) return;
        const details = labDetails[String(testCode)];
        const testInfo = labPrices.find(t => String(t.test_code) === String(testCode));
        const testName = testInfo ? testInfo.test_name : "לא ידוע";

        if (details) {
            testDetailsContentDiv.innerHTML = `
                <h4>פרטי בדיקה: ${testName} (${testCode})</h4>
                ${renderDetailRows(details)}
            `;
        } else {
            testDetailsContentDiv.innerHTML = `<p><strong>${testName} (${testCode})</strong></p><p>לא נמצאו פרטים נוספים עבור בדיקה זו.</p>`;
        }
    }

    // --- Calculation Logic ---
    function updateCalculations() {
        // Get current nurse base price
        const currentNursePrice = getCurrentNurseBasePrice();
        if (nurseVisitBasePriceSpan) nurseVisitBasePriceSpan.textContent = formatPrice(currentNursePrice);

        // Apply base package discount
        const baseDiscountVal = baseDiscountInput ? parseFloat(baseDiscountInput.value) : 0;
        const baseDiscountPercent = (baseDiscountContainer && !baseDiscountContainer.classList.contains("hidden") && baseDiscountVal > 0) ? baseDiscountVal : 0;
        const baseDiscountAmount = Math.round((currentNursePrice * baseDiscountPercent) / 100);
        const discountedNursePrice = currentNursePrice - baseDiscountAmount;

        if (summaryNursePriceSpan) summaryNursePriceSpan.textContent = formatPrice(discountedNursePrice);

        // Calculate lab tests total
        let labTestsTotal = 0;
        selectedLabTests.forEach(test => {
            const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
            labTestsTotal += parseFloat(price) || 0;
        });
        if (labTestsSubtotalSpan) labTestsSubtotalSpan.textContent = formatPrice(labTestsTotal);
        if (summaryLabTestsPriceSpan) summaryLabTestsPriceSpan.textContent = formatPrice(labTestsTotal);

        const finalPrice = discountedNursePrice + labTestsTotal;
        if (finalPriceSpan) finalPriceSpan.textContent = formatPrice(finalPrice);
    }

    function formatPrice(price) {
        if (typeof price !== "number" || isNaN(price)) return "0"; 
        return Math.round(price).toString(); 
    }

    // --- PDF Generation via Print Dialog ---
    function generateQuotePdfViaPrint() {
        const priceListName = priceListSelect.options[priceListSelect.selectedIndex].text;
        const currentDate = new Date().toLocaleDateString("he-IL");
        const logoPath = "assets/logo_final.png"; // Using the new logo

        // Get current values from the UI for PDF consistency
        const nurseBaseRaw = getCurrentNurseBasePrice();
        const baseDiscountVal = baseDiscountInput ? parseFloat(baseDiscountInput.value) : 0;
        const baseDiscountPercent = (baseDiscountContainer && !baseDiscountContainer.classList.contains("hidden") && baseDiscountVal > 0) ? baseDiscountVal : 0;
        const baseDiscountAmount = Math.round((nurseBaseRaw * baseDiscountPercent) / 100);
        const currentNurseBase = nurseBaseRaw - baseDiscountAmount;

        const labTestsSubtotal = parseFloat(labTestsSubtotalSpan.textContent.replace(/[^\d.-]/g, ""));
        const finalAmountIncludingVat = currentNurseBase + labTestsSubtotal;

        // VAT Calculation
        const amountBeforeVat = Math.round(finalAmountIncludingVat / 1.18);
        const vatAmount = Math.round(finalAmountIncludingVat - amountBeforeVat);

        let testsHtml = selectedLabTests.map(test => {
            const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
            return `<tr><td>${test.test_code}</td><td>${test.test_name}</td><td>${formatPrice(price)} ש\"ח</td></tr>`;
        }).join("");

        if (selectedLabTests.length === 0) {
            testsHtml = "<tr><td colspan=\"3\">לא נבחרו בדיקות.</td></tr>";
        }

        const quoteHtml = `
            <html>
            <head>
                <title>הצעת מחיר</title>
                <style>
                    body { direction: rtl; font-family: Arial, sans-serif !important; padding: 20px; margin: 0; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif !important; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-family: Arial, sans-serif !important; }
                    th { background-color: #f2f2f2; }
                    .pdf-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
                    .pdf-header img { max-width: 300px; max-height: 150px; margin-bottom: 10px; } /* Adjusted logo size */
                    .pdf-header p { margin: 2px 0; font-size: 0.9em; font-family: Arial, sans-serif !important; }
                    h1 { text-align: center; color: #007bff; margin-bottom: 5px; font-family: Arial, sans-serif !important; font-size: 1.8em; }
                    h2 { text-align: right; color: #0056b3; margin-top: 25px; margin-bottom:10px; font-family: Arial, sans-serif !important; font-size: 1.3em; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    p { margin: 5px 0; font-family: Arial, sans-serif !important; }
                    .section-summary p { margin: 8px 0; }
                    .summary-table td:first-child { font-weight: bold; }
                    .total-final { font-size: 1.2em; font-weight: bold; color: #dc3545; }
                    .quote-details p { text-align: center; margin-bottom: 10px; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="pdf-header">
                    <img src="${logoPath}" alt="לוגו החברה">
                    <p>טלפון: 3007* / 03-7643939</p>
                    <p>דוא"ל: assutaathome@assuta.co.il</p>
                </div>
                <h1>הצעת מחיר</h1>
                <div class="quote-details">
                    <p>תאריך: ${currentDate}</p>
                    <p>סוג מחירון: ${priceListName}</p>
                </div>
                
                <h2>חבילת בסיס (ביקור אחות, ספירת דם, כימיה בדם)</h2>
                <div class="section-summary">
                    ${baseDiscountPercent > 0 ? `<p>מחיר: ${formatPrice(nurseBaseRaw)} ש\"ח</p><p><strong>לאחר הנחה (${baseDiscountPercent}%): ${formatPrice(currentNurseBase)} ש\"ח</strong></p>` : `<p><strong>מחיר: ${formatPrice(currentNurseBase)} ש\"ח</strong></p>`}
                </div>

                <h2>בדיקות מעבדה נבחרות</h2>
                <table>
                    <thead><tr><th>קוד בדיקה</th><th>שם בדיקה</th><th>מחיר</th></tr></thead>
                    <tbody>${testsHtml}</tbody>
                </table>
                <div class="section-summary">
                    <p><strong>סה\"כ בדיקות: ${formatPrice(labTestsSubtotal)} ש\"ח</strong></p>
                </div>

                <h2>סיכום כללי</h2>
                <table class="summary-table">
                    ${baseDiscountPercent > 0 ? `<tr><td>חבילת בסיס (לפני הנחה):</td><td>${formatPrice(nurseBaseRaw)} ש\"ח</td></tr>
                    <tr><td>הנחה על חבילת בסיס (${baseDiscountPercent}%):</td><td>-${formatPrice(baseDiscountAmount)} ש\"ח</td></tr>
                    <tr><td>חבילת בסיס לאחר הנחה:</td><td>${formatPrice(currentNurseBase)} ש\"ח</td></tr>` : `<tr><td>חבילת בסיס:</td><td>${formatPrice(currentNurseBase)} ש\"ח</td></tr>`}
                    <tr><td>סה\"כ בדיקות מעבדה:</td><td>${formatPrice(labTestsSubtotal)} ש\"ח</td></tr>
                    <tr><td><strong>סה\"כ לפני מע\"מ:</strong></td><td><strong>${formatPrice(amountBeforeVat)} ש\"ח</strong></td></tr>
                    <tr><td>מע"מ (18%):</td><td>${formatPrice(vatAmount)} ש\"ח</td></tr>
                    <tr><td class="total-final"><strong>סכום סופי לתשלום (כולל מע"מ):</strong></td><td class="total-final"><strong>${formatPrice(finalAmountIncludingVat)} ש\"ח</strong></td></tr>
                </table>
            </body>
            </html>
        `;

        const printWindow = window.open("", "_blank");
        printWindow.document.open();
        printWindow.document.write(quoteHtml);
        printWindow.document.close();
        printWindow.focus(); 
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }
    
    function generateStaffPdfViaPrint() {
        const currentDate = new Date().toLocaleDateString("he-IL");
        const logoPath = "assets/logo_final.png"; // Using the new logo

        let testsDetailsHtml = selectedLabTests.map(test => {
            const details = labDetails[String(test.test_code)];
            if (details) {
                return `
                    <div class="test-item-staff">
                        <h3>${test.test_name} (${test.test_code})</h3>
                        ${renderDetailRows(details)}
                    </div>
                `;
            }
            return `<div class="test-item-staff"><h3>${test.test_name} (${test.test_code})</h3><p>לא נמצאו פרטים נוספים.</p></div>`;
        }).join("");

        if (selectedLabTests.length === 0) {
            testsDetailsHtml = "<p>לא נבחרו בדיקות.</p>";
        }

        const staffPdfHtml = `
            <html>
            <head>
                <title>רשימת בדיקות לצוות</title>
                <style>
                    body { direction: rtl; font-family: Arial, sans-serif !important; padding: 20px; margin: 0; }
                    .pdf-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; }
                    .pdf-header img { max-width: 300px; max-height: 150px; margin-bottom: 10px; } /* Adjusted logo size */
                    .pdf-header p { margin: 2px 0; font-size: 0.9em; font-family: Arial, sans-serif !important; }
                    h1 { text-align: center; color: #007bff; margin-bottom: 20px; font-family: Arial, sans-serif !important; font-size: 1.8em; }
                    .test-item-staff { border: 1px solid #eee; padding: 15px; margin-bottom: 15px; border-radius: 5px; background-color: #f9f9f9; }
                    .test-item-staff h3 { color: #0056b3; margin-top: 0; margin-bottom: 10px; font-size: 1.2em; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                    .test-item-staff p { margin: 5px 0; font-size: 0.95em; }
                    .test-item-staff strong { color: #333; }
                    .quote-details p { text-align: center; margin-bottom: 10px; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="pdf-header">
                    <img src="${logoPath}" alt="לוגו החברה">
                    <p>טלפון: 3007* / 03-7643939</p>
                    <p>דוא"ל: assutaathome@assuta.co.il</p>
                </div>
                <h1>רשימת בדיקות לצוות</h1>
                <div class="quote-details">
                    <p>תאריך הפקה: ${currentDate}</p>
                </div>
                ${testsDetailsHtml}
            </body>
            </html>
        `;

        const printWindow = window.open("", "_blank");
        printWindow.document.open();
        printWindow.document.write(staffPdfHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }

    // --- Start the application ---
    initializeApp();
});
