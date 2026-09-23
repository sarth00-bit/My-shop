const signupForm = document.getElementById("signupForm");

const fullName = document.getElementById("fullName");
const email = document.getElementById("email");
const mobile = document.getElementById("mobile");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const terms = document.getElementById("terms");

const fullNameError = document.getElementById("fullNameError");
const emailError = document.getElementById("emailError");
const mobileError = document.getElementById("mobileError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError =
    document.getElementById("confirmPasswordError");
const termsError = document.getElementById("termsError");

const signupError = document.getElementById("signupError");

const signupButton = document.getElementById("signupButton");


// ==========================================
// SHOW / HIDE PASSWORD
// ==========================================

document
    .getElementById("togglePassword")
    .addEventListener("click", function () {

        if (password.type === "password") {

            password.type = "text";
            this.textContent = "Hide";

        } else {

            password.type = "password";
            this.textContent = "Show";

        }
    });


document
    .getElementById("toggleConfirmPassword")
    .addEventListener("click", function () {

        if (confirmPassword.type === "password") {

            confirmPassword.type = "text";
            this.textContent = "Hide";

        } else {

            confirmPassword.type = "password";
            this.textContent = "Show";

        }
    });


// ==========================================
// VALIDATION FUNCTION
// ==========================================

function validateForm() {

    let valid = true;


    // Clear previous errors

    fullNameError.textContent = "";
    emailError.textContent = "";
    mobileError.textContent = "";
    passwordError.textContent = "";
    confirmPasswordError.textContent = "";
    termsError.textContent = "";

    signupError.style.display = "none";


    document.querySelectorAll("input").forEach(input => {
        input.classList.remove("input-error");
    });


    // ======================================
    // FULL NAME
    // ======================================

    if (fullName.value.trim() === "") {

        fullNameError.textContent =
            "Full name is required.";

        fullName.classList.add("input-error");

        valid = false;

    } else if (fullName.value.trim().length < 3) {

        fullNameError.textContent =
            "Enter a valid full name.";

        fullName.classList.add("input-error");

        valid = false;
    }


    // ======================================
    // EMAIL
    // ======================================

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email.value.trim() === "") {

        emailError.textContent =
            "Email address is required.";

        email.classList.add("input-error");

        valid = false;

    } else if (!emailPattern.test(email.value.trim())) {

        emailError.textContent =
            "Enter a valid email address.";

        email.classList.add("input-error");

        valid = false;
    }


    // ======================================
    // MOBILE
    // ======================================

    const mobilePattern = /^[6-9][0-9]{9}$/;

    if (mobile.value.trim() === "") {

        mobileError.textContent =
            "Mobile number is required.";

        mobile.classList.add("input-error");

        valid = false;

    } else if (!mobilePattern.test(mobile.value.trim())) {

        mobileError.textContent =
            "Enter a valid 10-digit mobile number.";

        mobile.classList.add("input-error");

        valid = false;
    }


    // ======================================
    // PASSWORD
    // ======================================

    if (password.value === "") {

        passwordError.textContent =
            "Password is required.";

        password.classList.add("input-error");

        valid = false;

    } else if (password.value.length < 6) {

        passwordError.textContent =
            "Password must contain at least 6 characters.";

        password.classList.add("input-error");

        valid = false;
    }


    // ======================================
    // CONFIRM PASSWORD
    // ======================================

    if (confirmPassword.value === "") {

        confirmPasswordError.textContent =
            "Please confirm your password.";

        confirmPassword.classList.add("input-error");

        valid = false;

    } else if (
        password.value !== confirmPassword.value
    ) {

        confirmPasswordError.textContent =
            "Passwords do not match.";

        confirmPassword.classList.add("input-error");

        valid = false;
    }


    // ======================================
    // TERMS
    // ======================================

    if (!terms.checked) {

        termsError.textContent =
            "You must accept the terms.";

        valid = false;
    }


    return valid;
}


// ==========================================
// SUBMIT FORM
// ==========================================

signupForm.addEventListener("submit", async function (event) {

    event.preventDefault();


    // Validate

    if (!validateForm()) {
        return;
    }


    // ======================================
    // LOADING STATE
    // ======================================

    signupButton.disabled = true;
    signupButton.classList.add("loading");


    /*
        DEVELOPMENT VERSION

        Later replace this section with:

        const response = await fetch("/api/auth/register", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name: fullName.value,
                email: email.value,
                mobile: mobile.value,
                password: password.value
            })
        });

        const data = await response.json();
    */


    // Simulate API request

    await new Promise(resolve => {
        setTimeout(resolve, 1200);
    });


    // ======================================
    // DEMO REGISTRATION
    // ======================================

    const user = {
        name: fullName.value.trim(),
        email: email.value.trim(),
        mobile: mobile.value.trim()
    };


    // Store temporary demo account

    localStorage.setItem(
        "demoUser",
        JSON.stringify(user)
    );


    // Remove loading

    signupButton.disabled = false;
    signupButton.classList.remove("loading");


    // Success message

    alert("Account created successfully! Please login.");

        window.location.href = "login.html";

});


// ==========================================
// INPUT CLEANUP
// ==========================================

// Allow only numbers in mobile field

mobile.addEventListener("input", function () {

    this.value = this.value.replace(/\D/g, "");

});


// Clear errors while typing

fullName.addEventListener("input", function () {
    fullNameError.textContent = "";
    fullName.classList.remove("input-error");
});

email.addEventListener("input", function () {
    emailError.textContent = "";
    email.classList.remove("input-error");
});

mobile.addEventListener("input", function () {
    mobileError.textContent = "";
    mobile.classList.remove("input-error");
});

password.addEventListener("input", function () {
    passwordError.textContent = "";
    password.classList.remove("input-error");
});

confirmPassword.addEventListener("input", function () {
    confirmPasswordError.textContent = "";
    confirmPassword.classList.remove("input-error");
});

terms.addEventListener("change", function () {
    termsError.textContent = "";
});