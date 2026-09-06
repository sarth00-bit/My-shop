const loginForm = document.getElementById("loginForm");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const usernameError = document.getElementById("usernameError");
const passwordError = document.getElementById("passwordError");
const loginError = document.getElementById("loginError");

const togglePassword = document.getElementById("togglePassword");

const loginButton = document.getElementById("loginButton");
const buttonText = document.getElementById("buttonText");

const rememberMe = document.getElementById("rememberMe");


// --------------------------------------------------
// Demo Users
// --------------------------------------------------

const demoUsers = [
    {
        username: "admin",
        password: "admin123",
        role: "Admin"
    },
    {
        username: "staff",
        password: "staff123",
        role: "Staff"
    }
];


// --------------------------------------------------
// Show / Hide Password
// --------------------------------------------------

togglePassword.addEventListener("click", function () {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";
        togglePassword.textContent = "Hide";
        togglePassword.setAttribute("aria-label", "Hide password");

    } else {

        passwordInput.type = "password";
        togglePassword.textContent = "Show";
        togglePassword.setAttribute("aria-label", "Show password");

    }
});


// --------------------------------------------------
// Validation
// --------------------------------------------------

function validateForm() {

    let isValid = true;

    usernameError.textContent = "";
    passwordError.textContent = "";
    loginError.style.display = "none";

    usernameInput.classList.remove("input-error");
    passwordInput.classList.remove("input-error");


    // Username validation

    if (usernameInput.value.trim() === "") {

        usernameError.textContent = "Username or email is required.";
        usernameInput.classList.add("input-error");

        isValid = false;
    }


    // Password validation

    if (passwordInput.value.trim() === "") {

        passwordError.textContent = "Password is required.";
        passwordInput.classList.add("input-error");

        isValid = false;

    } else if (passwordInput.value.length < 6) {

        passwordError.textContent =
            "Password must contain at least 6 characters.";

        passwordInput.classList.add("input-error");

        isValid = false;
    }


    return isValid;
}


// --------------------------------------------------
// Login
// --------------------------------------------------

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();


    // Validate form

    if (!validateForm()) {
        return;
    }


    const username = usernameInput.value.trim();
    const password = passwordInput.value;


    // Loading state

    loginButton.disabled = true;
    loginButton.classList.add("loading");


    /*
        DEMO AUTHENTICATION

        Replace this section later with:

        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await response.json();
    */


    await new Promise(resolve => setTimeout(resolve, 1000));


    const user = demoUsers.find(
        account =>
            account.username.toLowerCase() === username.toLowerCase() &&
            account.password === password
    );


    if (user) {

        // Remember username

        if (rememberMe.checked) {

            localStorage.setItem("rememberedUsername", username);

        } else {

            localStorage.removeItem("rememberedUsername");
        }


        // Store demo session

        sessionStorage.setItem(
            "loggedInUser",
            JSON.stringify({
                username: user.username,
                role: user.role
            })
        );


        // Successful login

       // Successful login
        alert(`Login successful! Welcome ${user.role}.`);

        window.location.href = "Dashboard.html";

    } else {

        loginError.textContent =
            "Invalid username or password. Please try again.";

        loginError.style.display = "block";
    }


    // Remove loading state

    loginButton.disabled = false;
    loginButton.classList.remove("loading");

});


// --------------------------------------------------
// Remember Me
// --------------------------------------------------

window.addEventListener("DOMContentLoaded", function () {

    const savedUsername =
        localStorage.getItem("rememberedUsername");

    if (savedUsername) {

        usernameInput.value = savedUsername;
        rememberMe.checked = true;
    }
});


// --------------------------------------------------
// Remove Error While Typing
// --------------------------------------------------

usernameInput.addEventListener("input", function () {

    usernameError.textContent = "";
    usernameInput.classList.remove("input-error");
    loginError.style.display = "none";

});


passwordInput.addEventListener("input", function () {

    passwordError.textContent = "";
    passwordInput.classList.remove("input-error");
    loginError.style.display = "none";

});