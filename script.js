// Global variable to store lab prices
let labPrices = [];

document.addEventListener("DOMContentLoaded", async () => {
    // Configuration
    const NURSE_VISIT_BASE_PRICE = 710;
    // const NURSE_VISIT_TEST_CODES = ["5022", "6331"]; // CBC and SMAC - Not directly used for adding to list, but for info

    // DOM Elements
    const nurseVisitDiscountInput = document.getElementById("nurseDiscount");
    const nurseVisitSubtotalSpan = document.getElementById("nurseDiscountedPrice");

    const testSearchInput = document.getElementById("testSearch");
    const searchResultsDiv = document.getElementById("testSuggestions");
    const selectedTestsUl = document.getElementById("selectedTestsList");
    const labTestsSubtotalSpan = document.getElementById("labTestsSubtotal");
    const labTestsDiscountInput = document.getElementById("labTestsDiscount");
    const labTestsDiscountedTotalSpan = document.getElementById("labTestsDiscountedTotal");

    const summaryNursePriceSpan = document.getElementById("summaryNursePrice");
    const summaryLabTestsPriceSpan = document.getElementById("summaryLabTestsPrice");
    const grandTotalSpan = document.getElementById("grandTotal");
    const overallDiscountInput = document.getElementById("grandTotalDiscount");
    const finalPriceSpan = document.getElementById("finalAmount");

    let selectedLabTests = [];

    async function loadLabPrices() {
        const jsonPath = "assets/data/lab_prices.json"; // Changed path
        console.log(`Attempting to fetch lab prices from: ${jsonPath}`);
        try {
            const response = await fetch(jsonPath);
            console.log("Fetch response received. Status:", response.status, "OK:", response.ok);
            if (!response.ok) {
                throw new Error(`שגיאת רשת בטעינת הנתונים: ${response.status} ${response.statusText}`);
            }
            labPrices = await response.json();
            console.log("Lab prices loaded and parsed successfully. Number of items:", labPrices.length);
            if (labPrices.length === 0) {
                console.warn("Warning: lab_prices.json was loaded but is empty.");
                if(searchResultsDiv) searchResultsDiv.innerHTML = 
                    '<p style="color: red;">קובץ נתוני הבדיקות נטען אך הוא ריק. אנא בדוק את הקובץ.</p>';
            }
            updateCalculations(); // Initial calculation after loading
        } catch (error) {
            console.error("שגיאה קריטית בטעינת נתוני הבדיקות:", error);
            if(searchResultsDiv) searchResultsDiv.innerHTML = 
                `<p style="color: red;">שגיאה בטעינת נתוני הבדיקות: ${error.message}. אנא נסה לרענן את הדף או בדוק את קובץ הנתונים ואת נתיב הקובץ בשרת.</p>`;
        }
    }

    if (nurseVisitDiscountInput) nurseVisitDiscountInput.addEventListener("input", updateCalculations);
    if (testSearchInput) testSearchInput.addEventListener("input", handleSearch);
    if (labTestsDiscountInput) labTestsDiscountInput.addEventListener("input", updateCalculations);
    if (overallDiscountInput) overallDiscountInput.addEventListener("input", updateCalculations);

    function handleSearch() {
        if (!testSearchInput || !searchResultsDiv) return;
        const query = testSearchInput.value.toLowerCase().trim();
        searchResultsDiv.innerHTML = "";

        if (query.length < 1) return;

        if (!labPrices || labPrices.length === 0) {
            searchResultsDiv.innerHTML = 
                '<p style="color: orange;">נתוני הבדיקות עדיין בטעינה או שלא נטענו כראוי. אנא המתן או רענן.</p>';
            console.log("Search attempted before labPrices were loaded or if labPrices is empty. Current labPrices length:", labPrices?.length);
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
                li.textContent = `(${test.test_code}) ${test.test_name} - ${formatPrice(test.price)} ש"ח`;
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
        }
        if (testSearchInput) testSearchInput.value = "";
        if (searchResultsDiv) searchResultsDiv.innerHTML = "";
    }

    function removeTestFromSelected(testCode) {
        selectedLabTests = selectedLabTests.filter(t => String(t.test_code) !== String(testCode));
        renderSelectedTests();
        updateCalculations();
    }

    function renderSelectedTests() {
        if (!selectedTestsUl) return;
        selectedTestsUl.innerHTML = "";
        selectedLabTests.forEach(test => {
            const li = document.createElement("li");
            li.innerHTML = `(${test.test_code}) ${test.test_name} - ${formatPrice(test.price)} ש"ח <button class="remove-btn" data-code="${test.test_code}">הסר</button>`;
            const removeButton = li.querySelector(".remove-btn");
            if (removeButton) {
                removeButton.addEventListener("click", () => removeTestFromSelected(test.test_code));
            }
            selectedTestsUl.appendChild(li);
        });
    }

    function updateCalculations() {
        let nurseVisitTotal = NURSE_VISIT_BASE_PRICE;
        const nurseDiscountVal = nurseVisitDiscountInput ? parseFloat(nurseVisitDiscountInput.value) : 0;
        const nurseDiscountPercent = nurseDiscountVal || 0;
        const nurseDiscountAmount = (nurseVisitTotal * nurseDiscountPercent) / 100;
        const discountedNurseVisitTotal = nurseVisitTotal - nurseDiscountAmount;
        if (nurseVisitSubtotalSpan) nurseVisitSubtotalSpan.textContent = formatPrice(discountedNurseVisitTotal);
        if (summaryNursePriceSpan) summaryNursePriceSpan.textContent = formatPrice(discountedNurseVisitTotal);

        let labTestsTotal = 0;
        selectedLabTests.forEach(test => {
            labTestsTotal += parseFloat(test.price) || 0;
        });
        if (labTestsSubtotalSpan) labTestsSubtotalSpan.textContent = formatPrice(labTestsTotal);

        const labTestsDiscountVal = labTestsDiscountInput ? parseFloat(labTestsDiscountInput.value) : 0;
        const labTestsDiscountPercent = labTestsDiscountVal || 0;
        const labTestsDiscountAmount = (labTestsTotal * labTestsDiscountPercent) / 100;
        const discountedLabTestsTotal = labTestsTotal - labTestsDiscountAmount;
        if (labTestsDiscountedTotalSpan) labTestsDiscountedTotalSpan.textContent = formatPrice(discountedLabTestsTotal);
        if (summaryLabTestsPriceSpan) summaryLabTestsPriceSpan.textContent = formatPrice(discountedLabTestsTotal);

        const currentGrandTotal = discountedNurseVisitTotal + discountedLabTestsTotal;
        if (grandTotalSpan) grandTotalSpan.textContent = formatPrice(currentGrandTotal);

        const overallDiscountVal = overallDiscountInput ? parseFloat(overallDiscountInput.value) : 0;
        const overallDiscountPercent = overallDiscountVal || 0;
        const overallDiscountAmount = (currentGrandTotal * overallDiscountPercent) / 100;
        const finalPrice = currentGrandTotal - overallDiscountAmount;
        if (finalPriceSpan) finalPriceSpan.textContent = formatPrice(finalPrice);
    }

    function formatPrice(price) {
        if (typeof price !== 'number' || isNaN(price)) {
            return '0.00';
        }
        return price.toFixed(2);
    }

    async function initializeApp() {
        console.log("Initializing app...");
        await loadLabPrices();
        // updateCalculations() is called within loadLabPrices after successful fetch or if DOM elements exist for initial state.
        // Call it once more to ensure UI is set up if not called by loadLabPrices (e.g. if fetch fails but elements are there)
        updateCalculations(); 
    }

    initializeApp();
});

