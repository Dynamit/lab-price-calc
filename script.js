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
    const nurseVisitBasePriceSpan = document.getElementById("nurseBasePrice"); // To update if base price changes by type
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
        updateCalculations(); // Initial calculation after loading data
    }

    // --- Data Loading Functions ---
    async function loadLabPrices() {
        const jsonPath = "assets/data/lab_prices.json";
        console.log(`Attempting to fetch lab prices from: ${jsonPath}`);
        try {
            const response = await fetch(jsonPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            labPrices = await response.json();
            console.log("Lab prices loaded successfully:", labPrices.length, "items");
            if (labPrices.length === 0) {
                console.warn("Warning: lab_prices.json was loaded but is empty.");
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
        console.log(`Attempting to fetch lab details from: ${jsonPath}`);
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
        console.log("Price type changed to:", currentPriceType);
        updateCalculations(); // Recalculate all prices with the new type
        renderSelectedTests(); // Re-render selected tests to show new prices
    });

    if (nurseVisitDiscountInput) nurseVisitDiscountInput.addEventListener("input", updateCalculations);
    if (testSearchInput) testSearchInput.addEventListener("input", handleSearch);
    if (labTestsDiscountInput) labTestsDiscountInput.addEventListener("input", updateCalculations);
    if (overallDiscountInput) overallDiscountInput.addEventListener("input", updateCalculations);
    if (exportPdfButton) exportPdfButton.addEventListener("click", generatePdf);

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
            displayTestDetails(test.test_code); // Display details for the newly added test
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
            // Optionally, display details of the last selected test or clear details
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
                if (!e.target.classList.contains("remove-btn")) { // Don't trigger if remove button is clicked
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
        const nurseDiscountAmount = (nurseVisitTotal * nurseDiscountPercent) / 100;
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
        const labTestsDiscountAmount = (labTestsTotal * labTestsDiscountPercent) / 100;
        const discountedLabTestsTotal = labTestsTotal - labTestsDiscountAmount;
        if (labTestsDiscountedTotalSpan) labTestsDiscountedTotalSpan.textContent = formatPrice(discountedLabTestsTotal);
        if (summaryLabTestsPriceSpan) summaryLabTestsPriceSpan.textContent = formatPrice(discountedLabTestsTotal);

        // Grand Total Calculation
        const currentGrandTotal = discountedNurseVisitTotal + discountedLabTestsTotal;
        if (grandTotalSpan) grandTotalSpan.textContent = formatPrice(currentGrandTotal);

        const overallDiscountVal = overallDiscountInput ? parseFloat(overallDiscountInput.value) : 0;
        const overallDiscountPercent = overallDiscountVal || 0;
        const overallDiscountAmount = (currentGrandTotal * overallDiscountPercent) / 100;
        const finalPrice = currentGrandTotal - overallDiscountAmount;
        if (finalPriceSpan) finalPriceSpan.textContent = formatPrice(finalPrice);
    }

    function formatPrice(price) {
        if (typeof price !== "number" || isNaN(price)) return "0.00";
        return price.toFixed(2);
    }

    // --- PDF Generation ---
    async function generatePdf() {
        alert("פונקציית ייצוא ל-PDF תיושם בהמשך. כרגע זהו Placeholder.");
        // Placeholder for PDF generation logic. Will use a library like jsPDF or call a server-side endpoint.
        // For client-side generation with jsPDF (example, would need to install/include library):
        // const { jsPDF } = window.jspdf;
        // const doc = new jsPDF();
        // doc.text("הצעת מחיר", 10, 10);
        // ... add more content ...
        // doc.save("הצעת_מחיר.pdf");
        console.log("PDF Export button clicked.");
    }

    // --- Start the application ---
    initializeApp();
});

