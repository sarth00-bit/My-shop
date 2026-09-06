// ================================
// INDEX PAGE JAVASCRIPT
// ================================

// Smooth scroll for internal links
document.querySelectorAll('a[href^="#"]').forEach(link => {

    link.addEventListener("click", function (event) {

        const target = document.querySelector(
            this.getAttribute("href")
        );

        if (target) {
            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth"
            });
        }

    });

});


// ================================
// CHECK LOGIN STATUS
// ================================

// If the user is already logged in,
// you can later use this section to
// redirect them directly to dashboard.

const loggedInUser = sessionStorage.getItem("loggedInUser");

if (loggedInUser) {

    console.log("User is already logged in.");

    /*
    Later, if you want:

    window.location.href = "dashboard.html";
    */
}