// Global variables
let labPrices = []; // To store test codes, names, and their private/tourist prices
let labDetails = {}; // To store additional details for each test, keyed by test_code
let currentPriceType = "private"; // Default price type
let selectedLabTests = []; // Array to store currently selected lab tests

// Base price for nurse visit - user confirmed this is the same for private and tourist
const NURSE_VISIT_BASE_PRICE = 710;

document.addEventListener("DOMContentLoaded", async () => {
    // DOM Elements
    const priceListSelect = document.getElementById("priceListSelect");

    const nurseVisitDiscountInput = document.getElementById("nurseDiscount");
    const nurseVisitBasePriceSpan = document.getElementById("nurseBasePrice"); 
    const nurseVisitDiscountedPriceSpan = document.getElementById("nurseDiscountedPrice");

    const testSearchInput = document.getElementById("testSearch");
    const searchResultsDiv = document.getElementById("testSuggestions");
    const selectedTestsUl = document.getElementById("selectedTestsList");
    const labTestsSubtotalSpan = document.getElementById("labTestsSubtotal");
    const labTestsDiscountInput = document.getElementById("labTestsDiscount");
    const labTestsDiscountedTotalSpan = document.getElementById("labTestsDiscountedTotal");

    const testDetailsContentDiv = document.getElementById("testDetailsContent");

    const summaryNursePriceSpan = document.getElementById("summaryNursePrice");
    const summaryLabTestsPriceSpan = document.getElementById("summaryLabTestsPrice");
    const grandTotalSpan = document.getElementById("grandTotal");
    const overallDiscountInput = document.getElementById("grandTotalDiscount");
    const finalPriceSpan = document.getElementById("finalAmount");

    const exportPdfButton = document.getElementById("exportPdfButton");

    // --- Initialization ---
    async function initializeApp() {
        console.log("Initializing app...");
        if (nurseVisitBasePriceSpan) nurseVisitBasePriceSpan.textContent = formatPrice(NURSE_VISIT_BASE_PRICE);
        await Promise.all([
            loadLabPrices(), 
            loadLabDetails()
        ]);
        updateCalculations(); 
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
                    `<p style="color: red;">קובץ מחירי הבדיקות נטען אך הוא ריק.</p>`;
            }
        } catch (error) {
            console.error("Error loading lab prices:", error);
            if(searchResultsDiv) searchResultsDiv.innerHTML = 
                `<p style="color: red;">שגיאה בטעינת מחירי הבדיקות: ${error.message}.</p>`;
        }
    }

    async function loadLabDetails() {
        const jsonPath = "assets/data/lab_details.json";
        try {
            const response = await fetch(jsonPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            labDetails = await response.json();
            console.log("Lab details loaded successfully. Number of entries:", Object.keys(labDetails).length);
        } catch (error) {
            console.error("Error loading lab details:", error);
            if(testDetailsContentDiv) testDetailsContentDiv.innerHTML = 
                `<p style="color: red;">שגיאה בטעינת פרטי הבדיקות: ${error.message}.</p>`;
        }
    }

    // --- Event Listeners ---
    if (priceListSelect) priceListSelect.addEventListener("change", (event) => {
        currentPriceType = event.target.value;
        updateCalculations(); 
        renderSelectedTests(); 
    });

    if (nurseVisitDiscountInput) nurseVisitDiscountInput.addEventListener("input", updateCalculations);
    if (testSearchInput) testSearchInput.addEventListener("input", handleSearch);
    if (labTestsDiscountInput) labTestsDiscountInput.addEventListener("input", updateCalculations);
    if (overallDiscountInput) overallDiscountInput.addEventListener("input", updateCalculations);
    if (exportPdfButton) exportPdfButton.addEventListener("click", generatePdfViaPrint);

    // --- Search and Selection Logic ---
    function handleSearch() {
        if (!testSearchInput || !searchResultsDiv) return;
        const query = testSearchInput.value.toLowerCase().trim();
        searchResultsDiv.innerHTML = "";
        if (query.length < 1) return;
        if (!labPrices || labPrices.length === 0) {
            searchResultsDiv.innerHTML = `<p style="color: orange;">מחירי הבדיקות בטעינה או שלא נטענו.</p>`;
            return;
        }
        const filteredTests = labPrices.filter(test => 
            (test.test_name && test.test_name.toLowerCase().includes(query)) || 
            (test.test_code && String(test.test_code).toLowerCase().includes(query))
        );
        if (filteredTests.length > 0) {
            const ul = document.createElement("ul");
            filteredTests.slice(0, 15).forEach(test => {
                const li = document.createElement("li");
                const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
                li.textContent = `(${test.test_code}) ${test.test_name} - ${formatPrice(price)} ש"ח`;
                li.addEventListener("click", () => addTestToSelected(test));
                ul.appendChild(li);
            });
            searchResultsDiv.appendChild(ul);
        } else {
            searchResultsDiv.innerHTML = "<p>לא נמצאו בדיקות תואמות.</p>";
        }
    }

    function addTestToSelected(test) {
        if (!selectedLabTests.find(t => String(t.test_code) === String(test.test_code))) {
            selectedLabTests.push(test);
            renderSelectedTests();
            updateCalculations();
            displayTestDetails(test.test_code); 
        }
        if (testSearchInput) testSearchInput.value = "";
        if (searchResultsDiv) searchResultsDiv.innerHTML = "";
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
    }

    function renderSelectedTests() {
        if (!selectedTestsUl) return;
        selectedTestsUl.innerHTML = "";
        selectedLabTests.forEach(test => {
            const li = document.createElement("li");
            const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
            li.innerHTML = `(${test.test_code}) ${test.test_name} - ${formatPrice(price)} ש"ח 
                          <button class="remove-btn" data-code="${test.test_code}">הסר</button>`;
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
        if (!testDetailsContentDiv || !labDetails) return;
        const details = labDetails[String(testCode)];
        if (details) {
            testDetailsContentDiv.innerHTML = `
                <h4>פרטי בדיקה: ${testCode}</h4>
                <p><strong>מבחנות נדרשות:</strong> ${details.tubes || "לא צוין"}</p>
                <p><strong>תנאי לקיחה ושימור:</strong> ${details.sampling_conditions || "לא צוין"}</p>
                <p><strong>הוראות שינוע:</strong> ${details.transport_instructions || "לא צוין"}</p>
                <p><strong>מידע על זמן ביצוע:</strong> ${details.execution_time_info || "לא צוין"}</p>
                <p><strong>משך זמן לקבלת תשובה:</strong> ${details.results_time || "לא צוין"}</p>
            `;
        } else {
            testDetailsContentDiv.innerHTML = "<p>לא נמצאו פרטים נוספים עבור בדיקה זו.</p>";
        }
    }

    // --- Calculation Logic ---
    function updateCalculations() {
        // Nurse Visit Calculation
        let nurseVisitTotal = NURSE_VISIT_BASE_PRICE;
        const nurseDiscountVal = nurseVisitDiscountInput ? parseFloat(nurseVisitDiscountInput.value) : 0;
        const nurseDiscountPercent = nurseDiscountVal || 0;
        let nurseDiscountAmount = (nurseVisitTotal * nurseDiscountPercent) / 100;
        nurseDiscountAmount = Math.round(nurseDiscountAmount); // Round discount amount
        const discountedNurseVisitTotal = nurseVisitTotal - nurseDiscountAmount;
        if (nurseVisitDiscountedPriceSpan) nurseVisitDiscountedPriceSpan.textContent = formatPrice(discountedNurseVisitTotal);
        if (summaryNursePriceSpan) summaryNursePriceSpan.textContent = formatPrice(discountedNurseVisitTotal);

        // Lab Tests Calculation
        let labTestsTotal = 0;
        selectedLabTests.forEach(test => {
            const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
            labTestsTotal += parseFloat(price) || 0;
        });
        if (labTestsSubtotalSpan) labTestsSubtotalSpan.textContent = formatPrice(labTestsTotal);

        const labTestsDiscountVal = labTestsDiscountInput ? parseFloat(labTestsDiscountInput.value) : 0;
        const labTestsDiscountPercent = labTestsDiscountVal || 0;
        let labTestsDiscountAmount = (labTestsTotal * labTestsDiscountPercent) / 100;
        labTestsDiscountAmount = Math.round(labTestsDiscountAmount); // Round discount amount
        const discountedLabTestsTotal = labTestsTotal - labTestsDiscountAmount;
        if (labTestsDiscountedTotalSpan) labTestsDiscountedTotalSpan.textContent = formatPrice(discountedLabTestsTotal);
        if (summaryLabTestsPriceSpan) summaryLabTestsPriceSpan.textContent = formatPrice(discountedLabTestsTotal);

        // Grand Total Calculation
        const currentGrandTotal = discountedNurseVisitTotal + discountedLabTestsTotal;
        if (grandTotalSpan) grandTotalSpan.textContent = formatPrice(currentGrandTotal);

        const overallDiscountVal = overallDiscountInput ? parseFloat(overallDiscountInput.value) : 0;
        const overallDiscountPercent = overallDiscountVal || 0;
        let overallDiscountAmount = (currentGrandTotal * overallDiscountPercent) / 100;
        overallDiscountAmount = Math.round(overallDiscountAmount); // Round discount amount
        const finalPrice = currentGrandTotal - overallDiscountAmount;
        if (finalPriceSpan) finalPriceSpan.textContent = formatPrice(finalPrice);
    }

    function formatPrice(price) {
        if (typeof price !== "number" || isNaN(price)) return "0"; 
        return Math.round(price).toString(); // Ensure all displayed prices are also rounded integers
    }

    // --- PDF Generation via Print Dialog ---
    function generatePdfViaPrint() {
        const priceListName = priceListSelect.options[priceListSelect.selectedIndex].text;
        const currentDate = new Date().toLocaleDateString("he-IL");

        let testsHtml = selectedLabTests.map(test => {
            const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
            return `<tr><td>${test.test_code}</td><td>${test.test_name}</td><td>${formatPrice(price)} ש"ח</td></tr>`;
        }).join("");

        if (selectedLabTests.length === 0) {
            testsHtml = "<tr><td colspan=\"3\">לא נבחרו בדיקות.</td></tr>";
        }

        const quoteHtml = `
            <html>
            <head>
                <title>הצעת מחיר</title>
                <style>
                    body { direction: rtl; font-family: Arial, sans-serif !important; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif !important; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-family: Arial, sans-serif !important; }
                    th { background-color: #f2f2f2; }
                    h1, h2 { text-align: center; color: #007bff; margin-bottom: 15px; font-family: Arial, sans-serif !important; }
                    h2 { margin-top: 25px; }
                    p { margin: 5px 0; font-family: Arial, sans-serif !important; }
                    .section-summary p { margin: 8px 0; }
                    .summary-table td:first-child { font-weight: bold; }
                    .total-final { font-size: 1.2em; font-weight: bold; color: #dc3545; }
                    .header-info p { text-align: center; margin-bottom: 20px; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <h1>הצעת מחיר</h1>
                <div class="header-info">
                    <p>תאריך: ${currentDate}</p>
                    <p>סוג מחירון: ${priceListName}</p>
                </div>
                
                <h2>חבילת בסיס (ביקור אחות, ספירת דם, כימיה בדם)</h2>
                <div class="section-summary">
                    <p>מחיר בסיס: ${formatPrice(NURSE_VISIT_BASE_PRICE)} ש"ח</p>
                    <p>% הנחה חבילת בסיס: ${nurseVisitDiscountInput.value}%</p>
                    <p><strong>מחיר חבילת בסיס לאחר הנחה: ${summaryNursePriceSpan.textContent} ש"ח</strong></p>
                </div>

                <h2>בדיקות מעבדה נבחרות</h2>
                <table>
                    <thead><tr><th>קוד בדיקה</th><th>שם בדיקה</th><th>מחיר</th></tr></thead>
                    <tbody>${testsHtml}</tbody>
                </table>
                <div class="section-summary">
                    <p>סכום ביניים לבדיקות (לפני הנחה): ${labTestsSubtotalSpan.textContent} ש"ח</p>
                    <p>% הנחה בדיקות מעבדה: ${labTestsDiscountInput.value}%</p>
                    <p><strong>סה"כ לבדיקות לאחר הנחה: ${summaryLabTestsPriceSpan.textContent} ש"ח</strong></p>
                </div>

                <h2>סיכום כללי</h2>
                <table class="summary-table">
                    <tr><td>חבילת בסיס (לאחר הנחה):</td><td>${summaryNursePriceSpan.textContent} ש"ח</td></tr>
                    <tr><td>סה"כ בדיקות מעבדה (לאחר הנחה):</td><td>${summaryLabTestsPriceSpan.textContent} ש"ח</td></tr>
                    <tr><td><strong>סה"כ ביניים (לפני הנחה כללית):</strong></td><td><strong>${grandTotalSpan.textContent} ש"ח</strong></td></tr>
                    <tr><td>% הנחה כללי:</td><td>${overallDiscountInput.value}%</td></tr>
                    <tr><td class="total-final"><strong>סכום סופי לתשלום:</strong></td><td class="total-final"><strong>${finalPriceSpan.textContent} ש"ח</strong></td></tr>
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

    // --- Start the application ---
    initializeApp();
});

