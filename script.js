// Global variable to store lab prices
let labPrices = [];

document.addEventListener("DOMContentLoaded", async () => {
    // Configuration
    const NURSE_VISIT_BASE_PRICE = 710;
    const NURSE_VISIT_TEST_CODES = ["5022", "6331"]; // CBC and SMAC

    // DOM Elements
    const nurseVisitCheckbox = document.getElementById("nurseVisitCheckbox");
    const nurseVisitDiscountInput = document.getElementById("nurseVisitDiscount");
    const nurseVisitSubtotalSpan = document.getElementById("nurseVisitSubtotal");

    const testSearchInput = document.getElementById("testSearchInput");
    const searchResultsDiv = document.getElementById("searchResults");
    const selectedTestsUl = document.getElementById("selectedTestsList");
    const labTestsSubtotalSpan = document.getElementById("labTestsSubtotal");
    const labTestsDiscountInput = document.getElementById("labTestsDiscount");
    const labTestsDiscountedTotalSpan = document.getElementById("labTestsDiscountedTotal");

    const grandTotalSpan = document.getElementById("grandTotal");
    const overallDiscountInput = document.getElementById("overallDiscount");
    const finalPriceSpan = document.getElementById("finalPrice");

    let selectedLabTests = [];

    // Function to load lab prices from JSON
    async function loadLabPrices() {
        try {
            const response = await fetch("assets/data/lab_prices.json");
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            labPrices = await response.json();
            console.log("Lab prices loaded successfully.");
            // Populate nurse visit tests after prices are loaded
            populateNurseVisitTests(); 
        } catch (error) {
            console.error("שגיאה בטעינת נתוני הבדיקות:", error);
            searchResultsDiv.innerHTML = '<p style="color: red;">שגיאה בטעינת נתוני הבדיקות. אנא נסה לרענן את הדף.</p>';
        }
    }

    function populateNurseVisitTests() {
        if (!labPrices || labPrices.length === 0) {
            console.error("Lab prices not loaded yet for nurse visit tests.");
            return;
        }
        NURSE_VISIT_TEST_CODES.forEach(code => {
            const test = labPrices.find(t => String(t.test_code) === String(code));
            if (test && nurseVisitCheckbox.checked) {
                // Add to selected tests if nurse visit is checked, but don't duplicate if already added by user
                // For simplicity, nurse visit tests are part of the 710, not added to lab tests list here
            }
        });
        updateCalculations();
    }

    // Event Listeners
    nurseVisitCheckbox.addEventListener("change", updateCalculations);
    nurseVisitDiscountInput.addEventListener("input", updateCalculations);
    testSearchInput.addEventListener("input", handleSearch);
    labTestsDiscountInput.addEventListener("input", updateCalculations);
    overallDiscountInput.addEventListener("input", updateCalculations);

    function handleSearch() {
        const query = testSearchInput.value.toLowerCase().trim();
        searchResultsDiv.innerHTML = "";

        if (query.length < 2) {
            return;
        }

        if (!labPrices || labPrices.length === 0) {
            searchResultsDiv.innerHTML = '<p style="color: orange;">נתוני הבדיקות עדיין בטעינה, אנא המתן...</p>';
            return;
        }

        const filteredTests = labPrices.filter(test => 
            (test.test_name && test.test_name.toLowerCase().includes(query)) || 
            (test.test_code && String(test.test_code).toLowerCase().includes(query))
        );

        if (filteredTests.length > 0) {
            const ul = document.createElement("ul");
            filteredTests.slice(0, 10).forEach(test => { // Limit results for performance
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
        if (!selectedLabTests.find(t => t.test_code === test.test_code)) {
            selectedLabTests.push(test);
            renderSelectedTests();
            updateCalculations();
        }
        testSearchInput.value = "";
        searchResultsDiv.innerHTML = "";
    }

    function removeTestFromSelected(testCode) {
        selectedLabTests = selectedLabTests.filter(t => t.test_code !== testCode);
        renderSelectedTests();
        updateCalculations();
    }

    function renderSelectedTests() {
        selectedTestsUl.innerHTML = "";
        selectedLabTests.forEach(test => {
            const li = document.createElement("li");
            li.innerHTML = `(${test.test_code}) ${test.test_name} - ${formatPrice(test.price)} ש"ח <button class="remove-btn" data-code="${test.test_code}">הסר</button>`;
            li.querySelector(".remove-btn").addEventListener("click", () => removeTestFromSelected(test.test_code));
            selectedTestsUl.appendChild(li);
        });
    }

    function updateCalculations() {
        let nurseVisitTotal = 0;
        if (nurseVisitCheckbox.checked) {
            nurseVisitTotal = NURSE_VISIT_BASE_PRICE;
        }
        const nurseDiscountPercent = parseFloat(nurseVisitDiscountInput.value) || 0;
        const nurseDiscountAmount = (nurseVisitTotal * nurseDiscountPercent) / 100;
        const discountedNurseVisitTotal = nurseVisitTotal - nurseDiscountAmount;
        nurseVisitSubtotalSpan.textContent = formatPrice(discountedNurseVisitTotal);

        let labTestsTotal = 0;
        selectedLabTests.forEach(test => {
            labTestsTotal += parseFloat(test.price) || 0;
        });
        labTestsSubtotalSpan.textContent = formatPrice(labTestsTotal);

        const labTestsDiscountPercent = parseFloat(labTestsDiscountInput.value) || 0;
        const labTestsDiscountAmount = (labTestsTotal * labTestsDiscountPercent) / 100;
        const discountedLabTestsTotal = labTestsTotal - labTestsDiscountAmount;
        labTestsDiscountedTotalSpan.textContent = formatPrice(discountedLabTestsTotal);

        const currentGrandTotal = discountedNurseVisitTotal + discountedLabTestsTotal;
        grandTotalSpan.textContent = formatPrice(currentGrandTotal);

        const overallDiscountPercent = parseFloat(overallDiscountInput.value) || 0;
        const overallDiscountAmount = (currentGrandTotal * overallDiscountPercent) / 100;
        const finalPrice = currentGrandTotal - overallDiscountAmount;
        finalPriceSpan.textContent = formatPrice(finalPrice);
    }

    function formatPrice(price) {
        return price.toFixed(2);
    }

    // Initial load and calculations
    async function initializeApp() {
        await loadLabPrices(); // This will also call populateNurseVisitTests and updateCalculations
        updateCalculations(); // Initial calculation after loading
    }

    initializeApp();
});

