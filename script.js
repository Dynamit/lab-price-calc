// Global variables
let labPrices = []; // To store test codes, names, and their private/tourist prices
let labDetails = {}; // To store additional details for each test, keyed by test_code
let currentPriceType = "private"; // Default price type
let selectedLabTests = []; // Array to store currently selected lab tests

// Base prices for nurse visit
const NURSE_VISIT_BASE_PRICE_PRIVATE = 710;
const NURSE_VISIT_BASE_PRICE_TOURIST = 890;

function getCurrentNurseBasePrice() {
    return currentPriceType === "tourist" ? NURSE_VISIT_BASE_PRICE_TOURIST : NURSE_VISIT_BASE_PRICE_PRIVATE;
}

document.addEventListener("DOMContentLoaded", async () => {
    // DOM Elements
    const priceListSelect = document.getElementById("priceListSelect");

    const toggleNurseDiscountBtn = document.getElementById("toggleNurseDiscountBtn");
    const nurseDiscountContainer = document.getElementById("nurseDiscountContainer");
    const nurseVisitDiscountInput = document.getElementById("nurseDiscount");
    const nurseVisitBasePriceSpan = document.getElementById("nurseBasePrice"); 
    const nurseVisitDiscountedPriceSpan = document.getElementById("nurseDiscountedPrice");
    const nurseFinalPriceText = document.getElementById("nurseFinalPriceText");

    const testSearchInput = document.getElementById("testSearch");
    const searchResultsDiv = document.getElementById("testSuggestions");
    const selectedTestsUl = document.getElementById("selectedTestsList");
    const labTestsSubtotalSpan = document.getElementById("labTestsSubtotal");
    const toggleLabTestsDiscountBtn = document.getElementById("toggleLabTestsDiscountBtn");
    const labTestsDiscountContainer = document.getElementById("labTestsDiscountContainer");
    const labTestsDiscountInput = document.getElementById("labTestsDiscount");
    const labTestsDiscountedTotalSpan = document.getElementById("labTestsDiscountedTotal");
    const labTestsFinalPriceText = document.getElementById("labTestsFinalPriceText");

    const testDetailsContentDiv = document.getElementById("testDetailsContent");

    const summaryNursePriceSpan = document.getElementById("summaryNursePrice");
    const summaryLabTestsPriceSpan = document.getElementById("summaryLabTestsPrice");
    const grandTotalSpan = document.getElementById("grandTotal");
    const toggleOverallDiscountBtn = document.getElementById("toggleOverallDiscountBtn");
    const overallDiscountContainer = document.getElementById("overallDiscountContainer");
    const overallDiscountInput = document.getElementById("grandTotalDiscount");
    const finalPriceSpan = document.getElementById("finalAmount");

    const exportPdfButton = document.getElementById("exportPdfButton");
    const exportStaffPdfButton = document.getElementById("exportStaffPdfButton");

    // --- Initialization ---
    async function initializeApp() {
        console.log("Initializing app...");
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
            labDetails = await response.json();
            console.log("Lab details loaded successfully. Number of entries:", Object.keys(labDetails).length);
        } catch (error) {
            console.error("Error loading lab details:", error);
            if(testDetailsContentDiv) testDetailsContentDiv.innerHTML = 
                `<p style=\"color: red;\">שגיאה בטעינת פרטי הבדיקות: ${error.message}.</p>`;
        }
    }

    // --- Event Listeners ---
    if (priceListSelect) priceListSelect.addEventListener("change", (event) => {
        currentPriceType = event.target.value;
        updateCalculations(); 
        renderSelectedTests(); 
    });

    // Discount Toggle Buttons
    if (toggleNurseDiscountBtn) toggleNurseDiscountBtn.addEventListener("click", () => {
        nurseDiscountContainer.classList.toggle("hidden");
        if (nurseDiscountContainer.classList.contains("hidden")) nurseVisitDiscountInput.value = 0;
        updateCalculations();
    });
    if (toggleLabTestsDiscountBtn) toggleLabTestsDiscountBtn.addEventListener("click", () => {
        labTestsDiscountContainer.classList.toggle("hidden");
        if (labTestsDiscountContainer.classList.contains("hidden")) labTestsDiscountInput.value = 0;
        updateCalculations();
    });
    if (toggleOverallDiscountBtn) toggleOverallDiscountBtn.addEventListener("click", () => {
        overallDiscountContainer.classList.toggle("hidden");
        if (overallDiscountContainer.classList.contains("hidden")) overallDiscountInput.value = 0;
        updateCalculations();
    });

    if (nurseVisitDiscountInput) nurseVisitDiscountInput.addEventListener("input", updateCalculations);
    if (testSearchInput) testSearchInput.addEventListener("input", handleSearch);
    if (labTestsDiscountInput) labTestsDiscountInput.addEventListener("input", updateCalculations);
    if (overallDiscountInput) overallDiscountInput.addEventListener("input", updateCalculations);
    if (exportPdfButton) exportPdfButton.addEventListener("click", generateQuotePdfViaPrint);
    if (exportStaffPdfButton) exportStaffPdfButton.addEventListener("click", generateStaffPdfViaPrint);

    // --- Search and Selection Logic ---
    function handleSearch() {
        if (!testSearchInput || !searchResultsDiv) return;
        const query = testSearchInput.value.toLowerCase().trim();
        searchResultsDiv.innerHTML = "";
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
            const ul = document.createElement("ul");
            filteredTests.slice(0, 15).forEach(test => {
                const li = document.createElement("li");
                const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
                li.textContent = `(${test.test_code}) ${test.test_name} - ${formatPrice(price)} ש\"ח`;
                li.addEventListener("click", () => addTestToSelected(test));
                ul.appendChild(li);
            });
            searchResultsDiv.appendChild(ul);
            searchResultsDiv.classList.add("active");
        } else {
            searchResultsDiv.innerHTML = "<p>לא נמצאו בדיקות תואמות.</p>";
            searchResultsDiv.classList.add("active");
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
        if (searchResultsDiv) {
            searchResultsDiv.innerHTML = "";
            searchResultsDiv.classList.remove("active");
        }
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
            li.innerHTML = `(${test.test_code}) ${test.test_name} - ${formatPrice(price)} ש\"ח 
                          <button class=\"remove-btn\" data-code=\"${test.test_code}\">הסר</button>`;
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
                <p><strong>תנאים והכנת החולה לפני הדיגום:</strong> ${details.patient_preparation_conditions || "לא צוין"}</p>
                <p><strong>מבחנות נדרשות:</strong> ${details.tubes || "לא צוין"}</p>
                <p><strong>תנאי לקיחה ושימור:</strong> ${details.sampling_conditions || "לא צוין"}</p>
                <p><strong>הוראות שינוע:</strong> ${details.transport_instructions || "לא צוין"}</p>
                <p><strong>מידע על זמן ביצוע:</strong> ${details.execution_time_info || "לא צוין"}</p>
                <p><strong>משך זמן לקבלת תשובה:</strong> ${details.results_time || "לא צוין"} (ימי עבודה)</p>
            `;
        } else {
            testDetailsContentDiv.innerHTML = `<p><strong>${testName} (${testCode})</strong></p><p>לא נמצאו פרטים נוספים עבור בדיקה זו.</p>`;
        }
    }

    // --- Calculation Logic ---
    function updateCalculations() {
        const currentNursePrice = getCurrentNurseBasePrice();
        if (nurseVisitBasePriceSpan) nurseVisitBasePriceSpan.textContent = formatPrice(currentNursePrice);

        const nurseDiscountVal = nurseVisitDiscountInput ? parseFloat(nurseVisitDiscountInput.value) : 0;
        const nurseDiscountPercent = (nurseDiscountContainer && !nurseDiscountContainer.classList.contains("hidden") && nurseDiscountVal > 0) ? nurseDiscountVal : 0;
        let nurseDiscountAmount = (currentNursePrice * nurseDiscountPercent) / 100;
        nurseDiscountAmount = Math.round(nurseDiscountAmount);
        const discountedNurseVisitTotal = currentNursePrice - nurseDiscountAmount;
        if (nurseVisitDiscountedPriceSpan) nurseVisitDiscountedPriceSpan.textContent = formatPrice(discountedNurseVisitTotal);
        if (summaryNursePriceSpan) summaryNursePriceSpan.textContent = formatPrice(discountedNurseVisitTotal);
        if (nurseFinalPriceText) nurseFinalPriceText.innerHTML = nurseDiscountPercent > 0 ? 
            `מחיר סופי חבילת בסיס (כולל ${nurseDiscountPercent}% הנחה): <span id=\"nurseDiscountedPrice\">${formatPrice(discountedNurseVisitTotal)}</span> ש\"ח` : 
            `מחיר סופי חבילת בסיס: <span id=\"nurseDiscountedPrice\">${formatPrice(discountedNurseVisitTotal)}</span> ש\"ח`;

        let labTestsTotal = 0;
        selectedLabTests.forEach(test => {
            const price = test.prices ? (test.prices[currentPriceType] || 0) : 0;
            labTestsTotal += parseFloat(price) || 0;
        });
        if (labTestsSubtotalSpan) labTestsSubtotalSpan.textContent = formatPrice(labTestsTotal);

        const labTestsDiscountVal = labTestsDiscountInput ? parseFloat(labTestsDiscountInput.value) : 0;
        const labTestsDiscountPercent = (labTestsDiscountContainer && !labTestsDiscountContainer.classList.contains("hidden") && labTestsDiscountVal > 0) ? labTestsDiscountVal : 0;
        let labTestsDiscountAmount = (labTestsTotal * labTestsDiscountPercent) / 100;
        labTestsDiscountAmount = Math.round(labTestsDiscountAmount);
        const discountedLabTestsTotal = labTestsTotal - labTestsDiscountAmount;
        if (labTestsDiscountedTotalSpan) labTestsDiscountedTotalSpan.textContent = formatPrice(discountedLabTestsTotal);
        if (summaryLabTestsPriceSpan) summaryLabTestsPriceSpan.textContent = formatPrice(discountedLabTestsTotal);
        if (labTestsFinalPriceText) labTestsFinalPriceText.innerHTML = labTestsDiscountPercent > 0 ? 
            `סה\"כ לבדיקות (כולל ${labTestsDiscountPercent}% הנחה): <span id=\"labTestsDiscountedTotal\">${formatPrice(discountedLabTestsTotal)}</span> ש\"ח` : 
            `סה\"כ לבדיקות: <span id=\"labTestsDiscountedTotal\">${formatPrice(discountedLabTestsTotal)}</span> ש\"ח`;

        const currentGrandTotal = discountedNurseVisitTotal + discountedLabTestsTotal;
        if (grandTotalSpan) grandTotalSpan.textContent = formatPrice(currentGrandTotal);

        const overallDiscountVal = overallDiscountInput ? parseFloat(overallDiscountInput.value) : 0;
        const overallDiscountPercent = (overallDiscountContainer && !overallDiscountContainer.classList.contains("hidden") && overallDiscountVal > 0) ? overallDiscountVal : 0;
        let overallDiscountAmount = (currentGrandTotal * overallDiscountPercent) / 100;
        overallDiscountAmount = Math.round(overallDiscountAmount);
        const finalPrice = currentGrandTotal - overallDiscountAmount;
        if (finalPriceSpan) finalPriceSpan.innerHTML = overallDiscountPercent > 0 ? 
            `סכום סופי לתשלום (כולל ${overallDiscountPercent}% הנחה): <span id=\"finalAmountValue\">${formatPrice(finalPrice)}</span> ש\"ח` : 
            `סכום סופי לתשלום: <span id=\"finalAmountValue\">${formatPrice(finalPrice)}</span> ש\"ח`;
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
        const currentNurseBase = getCurrentNurseBasePrice();
        const nurseDiscountVal = nurseVisitDiscountInput ? parseFloat(nurseVisitDiscountInput.value) : 0;
        const nurseDiscountPercent = (nurseDiscountContainer && !nurseDiscountContainer.classList.contains("hidden") && nurseDiscountVal > 0) ? nurseDiscountVal : 0;
        const nursePriceAfterDiscount = parseFloat(summaryNursePriceSpan.textContent.replace(/[^\d.-]/g, ""));

        const labTestsSubtotal = parseFloat(labTestsSubtotalSpan.textContent.replace(/[^\d.-]/g, ""));
        const labTestsDiscountVal = labTestsDiscountInput ? parseFloat(labTestsDiscountInput.value) : 0;
        const labTestsDiscountPercent = (labTestsDiscountContainer && !labTestsDiscountContainer.classList.contains("hidden") && labTestsDiscountVal > 0) ? labTestsDiscountVal : 0;
        const labTestsPriceAfterDiscount = parseFloat(summaryLabTestsPriceSpan.textContent.replace(/[^\d.-]/g, ""));

        const subtotalBeforeOverallDiscount = nursePriceAfterDiscount + labTestsPriceAfterDiscount;

        const overallDiscountVal = overallDiscountInput ? parseFloat(overallDiscountInput.value) : 0;
        const overallDiscountPercent = (overallDiscountContainer && !overallDiscountContainer.classList.contains("hidden") && overallDiscountVal > 0) ? overallDiscountVal : 0;
        const totalAfterOverallDiscount = parseFloat(document.getElementById("finalAmountValue").textContent.replace(/[^\d.-]/g, "")); // This is the final amount INCLUDING VAT
        
        // Correct VAT Calculation based on the final amount that INCLUDES VAT
        const finalAmountIncludingVat = totalAfterOverallDiscount;
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
                    <p>מחיר בסיס: ${formatPrice(currentNurseBase)} ש\"ח</p>
                    ${nurseDiscountPercent > 0 ? `<p>% הנחה חבילת בסיס: ${nurseDiscountPercent}%</p>` : ""}
                    <p><strong>מחיר חבילת בסיס ${nurseDiscountPercent > 0 ? "לאחר הנחה" : ""}: ${formatPrice(nursePriceAfterDiscount)} ש\"ח</strong></p>
                </div>

                <h2>בדיקות מעבדה נבחרות</h2>
                <table>
                    <thead><tr><th>קוד בדיקה</th><th>שם בדיקה</th><th>מחיר</th></tr></thead>
                    <tbody>${testsHtml}</tbody>
                </table>
                <div class="section-summary">
                    <p>סכום ביניים לבדיקות ${labTestsDiscountPercent > 0 ? "(לפני הנחה)" : ""}: ${formatPrice(labTestsSubtotal)} ש\"ח</p>
                    ${labTestsDiscountPercent > 0 ? `<p>% הנחה בדיקות מעבדה: ${labTestsDiscountPercent}%</p>` : ""}
                    <p><strong>סה\"כ לבדיקות ${labTestsDiscountPercent > 0 ? "לאחר הנחה" : ""}: ${formatPrice(labTestsPriceAfterDiscount)} ש\"ח</strong></p>
                </div>

                <h2>סיכום כללי</h2>
                <table class="summary-table">
                    <tr><td>חבילת בסיס ${nurseDiscountPercent > 0 ? "(לאחר הנחה)" : ""}:</td><td>${formatPrice(nursePriceAfterDiscount)} ש\"ח</td></tr>
                    <tr><td>סה\"כ בדיקות מעבדה ${labTestsDiscountPercent > 0 ? "(לאחר הנחה)" : ""}:</td><td>${formatPrice(labTestsPriceAfterDiscount)} ש\"ח</td></tr>
                    <tr><td><strong>סה\"כ ביניים ${overallDiscountPercent > 0 ? "(לפני הנחה כללית)" : ""}:</strong></td><td><strong>${formatPrice(subtotalBeforeOverallDiscount)} ש\"ח</strong></td></tr>
                    ${overallDiscountPercent > 0 ? `<tr><td>% הנחה כללי:</td><td>${overallDiscountPercent}%</td></tr>` : ""}
                    ${overallDiscountPercent > 0 ? `<tr><td><strong>סה\"כ לאחר הנחה כללית (לפני מע\"מ):</strong></td><td><strong>${formatPrice(amountBeforeVat)} ש\"ח</strong></td></tr>` : `<tr><td><strong>סה\"כ לפני מע\"מ:</strong></td><td><strong>${formatPrice(amountBeforeVat)} ש\"ח</strong></td></tr>`}
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
                        <p><strong>תנאים והכנת החולה לפני הדיגום:</strong> ${details.patient_preparation_conditions || "לא צוין"}</p>
                        <p><strong>מבחנות נדרשות:</strong> ${details.tubes || "לא צוין"}</p>
                        <p><strong>תנאי לקיחה ושימור:</strong> ${details.sampling_conditions || "לא צוין"}</p>
                        <p><strong>הוראות שינוע:</strong> ${details.transport_instructions || "לא צוין"}</p>
                        <p><strong>מידע על זמן ביצוע:</strong> ${details.execution_time_info || "לא צוין"}</p>
                        <p><strong>משך זמן לקבלת תשובה:</strong> ${details.results_time || "לא צוין"} (ימי עבודה)</p>
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

