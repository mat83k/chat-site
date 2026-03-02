document.addEventListener(
    "DOMContentLoaded",
    function ()
    {
        var toggleBtn;
        var contentBlock;
        var topBtn;

        toggleBtn =
            document.getElementById("toggleBtn");

        contentBlock =
            document.getElementById("contentBlock");

        if (toggleBtn !== null && contentBlock !== null)
        {
            toggleBtn.addEventListener(
                "click",
                function ()
                {
                    contentBlock.classList.toggle("hidden");

                    if (contentBlock.classList.contains("hidden"))
                    {
                        toggleBtn.textContent =
                            "Afficher le texte";
                    }
                    else
                    {
                        toggleBtn.textContent =
                            "Masquer le texte";
                    }
                }
            );
        }

        topBtn =
            document.getElementById("topBtn");

        if (topBtn !== null)
        {
            window.addEventListener(
                "scroll",
                function ()
                {
                    if (window.scrollY > 200)
                    {
                        topBtn.classList.add("show");
                    }
                    else
                    {
                        topBtn.classList.remove("show");
                    }
                }
            );

            topBtn.addEventListener(
                "click",
                function ()
                {
                    window.scrollTo(
                        {
                            top: 0,
                            behavior: "smooth"
                        }
                    );
                }
            );
        }
    }
);