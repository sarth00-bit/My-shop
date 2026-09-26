// ============================================================
// settings.js — fixed settings page
//
// Shop logo + admin name:
//   Saved in localStorage so all pages on the same website/origin
//   can immediately display them.
//
// UPI ID + Business Name + QR:
//   Saved through Node.js/MySQL.
//   QR image is uploaded to /api/settings/upi-qr.
//
// IMPORTANT:
// A browser <input type="file"> cannot be filled again by JavaScript
// after a page reload. This is a browser security restriction.
// Therefore we show the saved filename/status separately while the
// actual saved image remains visible in the preview.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');

    const logoInput = document.getElementById('shopLogoInput');
    const logoPreview = document.getElementById('logoPreview');
    const logoPlaceholder = document.getElementById('logoPlaceholderText');
    const logoFileStatus = document.getElementById('shopLogoFileStatus');

    const qrInput = document.getElementById('upiQrInput');
    const qrPreview = document.getElementById('upiQrPreview');
    const qrFileStatus = document.getElementById('upiQrFileStatus');

    let base64Logo = '';
    let selectedLogoFileName = '';

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    }

    // ------------------------------------------------------------
    // LOAD SETTINGS
    // ------------------------------------------------------------

    async function loadSettings() {
        let saved = {};

        try {
            saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
        } catch (error) {
            console.error('Unable to read local settings:', error);
        }

        setValue('shopName', saved.shopName || '');
        setValue('shopAddress', saved.shopAddress || '');
        setValue('shopPhone', saved.shopPhone || '');
        setValue('shopEmail', saved.shopEmail || '');
        setValue('shopGst', saved.shopGst || '');
        setValue('invoicePrefix', saved.invoicePrefix || 'INV-');
        setValue('currencySymbol', saved.currencySymbol || '₹');
        setValue('defaultTax', saved.defaultTax || 0);
        setValue('invoiceFooter', saved.invoiceFooter || '');
        setValue('userName', saved.userName || 'Admin');

        base64Logo = saved.logo || saved.shopLogo || '';
        selectedLogoFileName = saved.logoFileName || '';

        if (base64Logo) {
            showLogoPreview(base64Logo);
        }

        if (logoFileStatus) {
            logoFileStatus.textContent = selectedLogoFileName
                ? `Saved: ${selectedLogoFileName}`
                : (base64Logo ? 'Saved shop logo' : 'No logo saved');
            logoFileStatus.className =
                base64Logo
                    ? 'small text-success mt-1'
                    : 'small text-muted mt-1';
        }

        // Load UPI settings from Node/MySQL.
        try {
            const response = await apiFetch(`${NODE_API}/settings`);

            if (!response.ok) {
                throw new Error(`Settings API error ${response.status}`);
            }

            const remote = await response.json();

            const upiId =
                remote.upi_id ||
                remote.upiId ||
                '';

            const businessName =
                remote.business_name ||
                remote.upiName ||
                '';

            const qrImage =
                remote.upi_qr_image ||
                remote.qrImage ||
                remote.upiQrImage ||
                '';

            setValue('upiId', upiId);
            setValue('upiName', businessName);

            setUPIPreview(qrImage);

            if (qrFileStatus) {
                qrFileStatus.textContent =
                    qrImage ? 'Saved QR image on server / MySQL' :
                    'No QR image saved';

                qrFileStatus.className =
                    qrImage
                        ? 'small text-success mt-1'
                        : 'small text-muted mt-1';
            }
        } catch (error) {
            console.error('Could not load persistent UPI settings:', error);
            showSettingsMessage(
                'Unable to load UPI settings from the server.',
                'danger'
            );
        }

        const darkModeToggle =
            document.getElementById('darkModeToggle');

        if (darkModeToggle) {
            const isDark =
                localStorage.getItem('theme') === 'dark';

            darkModeToggle.checked = isDark;
            applyTheme(isDark);
        }
    }

    // ------------------------------------------------------------
    // SHOP LOGO FILE SELECTION
    // ------------------------------------------------------------

    if (logoInput) {
        logoInput.addEventListener('change', event => {
            const file = event.target.files?.[0];

            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showSettingsMessage(
                    'Please select a valid image file for the shop logo.',
                    'danger'
                );

                logoInput.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showSettingsMessage(
                    'Shop logo must be 5 MB or smaller.',
                    'danger'
                );

                logoInput.value = '';
                return;
            }

            selectedLogoFileName = file.name;

            const reader = new FileReader();

            reader.onload = event => {
                base64Logo = event.target.result;
                showLogoPreview(base64Logo);

                if (logoFileStatus) {
                    logoFileStatus.textContent =
                        `Selected: ${file.name}`;

                    logoFileStatus.className =
                        'small text-primary mt-1';
                }
            };

            reader.onerror = () => {
                showSettingsMessage(
                    'Unable to read the selected shop logo.',
                    'danger'
                );
            };

            reader.readAsDataURL(file);
        });
    }

    // ------------------------------------------------------------
    // UPI QR FILE SELECTION
    // ------------------------------------------------------------

    if (qrInput) {
        qrInput.addEventListener('change', event => {
            const file = event.target.files?.[0];

            if (!file) return;

            try {
                validateQRFile(file);
            } catch (error) {
                showSettingsMessage(error.message, 'danger');
                qrInput.value = '';
                return;
            }

            if (qrFileStatus) {
                qrFileStatus.textContent =
                    `Selected: ${file.name}`;

                qrFileStatus.className =
                    'small text-primary mt-1';
            }

            const reader = new FileReader();

            reader.onload = event => {
                if (qrPreview) {
                    qrPreview.src = event.target.result;
                    qrPreview.style.display = 'block';
                }
            };

            reader.onerror = () => {
                showSettingsMessage(
                    'Unable to preview the selected QR image.',
                    'danger'
                );
            };

            reader.readAsDataURL(file);
        });
    }

    // ------------------------------------------------------------
    // SAVE SETTINGS
    // ------------------------------------------------------------

    if (settingsForm) {
        settingsForm.addEventListener('submit', async event => {
            event.preventDefault();

            const darkModeToggle =
                document.getElementById('darkModeToggle');

            const isDark =
                darkModeToggle ? darkModeToggle.checked : false;

            const upiId = getVal('upiId');
            const businessName = getVal('upiName');

            const qrFile =
                qrInput?.files?.[0] || null;

            if (
                upiId &&
                !/^[^\s@]+@[^\s@]+$/.test(upiId)
            ) {
                showSettingsMessage(
                    'Please enter a valid UPI ID, for example shop@upi.',
                    'danger'
                );
                return;
            }

            const saveButton =
                settingsForm.querySelector('[type="submit"]');

            const originalButton =
                saveButton ? saveButton.innerHTML : '';

            if (saveButton) {
                saveButton.disabled = true;
                saveButton.innerHTML =
                    '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
            }

            try {
                let qrImageData = null;

                // Upload QR only when a NEW QR file is selected.
                if (qrFile) {
                    validateQRFile(qrFile);

                    const formData = new FormData();
                    formData.append('qr', qrFile);

                    const uploadResponse =
                        await apiFetch(`${NODE_API}/settings/upi-qr`, {
                            method: 'POST',
                            body: formData
                        });

                    if (!uploadResponse.ok) {
                        const errorData =
                            await safeJson(uploadResponse);

                        throw new Error(
                            errorData.error ||
                            'QR image upload failed.'
                        );
                    }

                    const uploadData =
                        await uploadResponse.json();

                    qrImageData =
                        uploadData.qrImage ||
                        uploadData.qr_image ||
                        uploadData.imagePath ||
                        '';

                    if (!qrImageData) {
                        throw new Error(
                            'QR upload succeeded but the server did not return the saved image.'
                        );
                    }

                    setUPIPreview(qrImageData);

                    if (qrFileStatus) {
                        qrFileStatus.textContent =
                            `Saved: ${qrFile.name}`;

                        qrFileStatus.className =
                            'small text-success mt-1';
                    }

                    // Remember only the display name locally.
                    localStorage.setItem(
                        'upiQrFileName',
                        qrFile.name
                    );
                }

                // Save UPI text fields to MySQL.
                const settingsPayload = {
                    upi_id: upiId,
                    business_name: businessName
                };

                const saveResponse =
                    await apiFetch(`${NODE_API}/settings`, {
                        method: 'PUT',
                        body: JSON.stringify(settingsPayload)
                    });

                if (!saveResponse.ok) {
                    const errorData =
                        await safeJson(saveResponse);

                    throw new Error(
                        errorData.error ||
                        'Unable to save UPI settings.'
                    );
                }

                // --------------------------------------------------------
                // SAVE SHOP INFORMATION LOCALLY
                // --------------------------------------------------------
                const existing =
                    JSON.parse(
                        localStorage.getItem('appSettings') || '{}'
                    );

                const localSettings = {
                    ...existing,

                    shopName: getVal('shopName'),
                    shopAddress: getVal('shopAddress'),
                    shopPhone: getVal('shopPhone'),
                    shopEmail: getVal('shopEmail'),
                    shopGst: getVal('shopGst'),

                    logo: base64Logo,
                    shopLogo: base64Logo,
                    logoFileName:
                        selectedLogoFileName ||
                        existing.logoFileName ||
                        '',

                    invoicePrefix:
                        getVal('invoicePrefix') || 'INV-',

                    currencySymbol:
                        getVal('currencySymbol') || '₹',

                    defaultTax:
                        parseFloat(getVal('defaultTax')) || 0,

                    invoiceFooter:
                        getVal('invoiceFooter'),

                    userName:
                        getVal('userName') || 'Admin',

                    adminName:
                        getVal('userName') || 'Admin'
                };

                // Never store UPI/QR in localStorage.
                delete localSettings.upiId;
                delete localSettings.upiName;
                delete localSettings.upiQrImage;

                localStorage.setItem(
                    'appSettings',
                    JSON.stringify(localSettings)
                );

                localStorage.setItem(
                    'theme',
                    isDark ? 'dark' : 'light'
                );

                applyTheme(isDark);

                // Immediately update the header on the Settings page.
                if (typeof window.refreshHeaderShopProfile === 'function') {
                    window.refreshHeaderShopProfile();
                }

                if (qrImageData) {
                    setUPIPreview(qrImageData);
                }

                showSettingsMessage(
                    qrImageData
                        ? 'Settings saved successfully. Shop logo, admin name, UPI information and QR image are saved.'
                        : 'Settings saved successfully. Shop logo, admin name and UPI information are saved.',
                    'success'
                );

            } catch (error) {
                console.error(
                    'Settings save failed:',
                    error
                );

                showSettingsMessage(
                    error.message ||
                    'Unable to save settings. Please try again.',
                    'danger'
                );
            } finally {
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.innerHTML = originalButton;
                }
            }
        });
    }

    // ------------------------------------------------------------
    // START
    // ------------------------------------------------------------

    loadSettings();
});

// ============================================================
// DARK MODE
// ============================================================

function toggleDarkMode(isDark) {
    applyTheme(isDark);

    localStorage.setItem(
        'theme',
        isDark ? 'dark' : 'light'
    );
}

function applyTheme(isDark) {
    document.body.classList.toggle(
        'dark-mode',
        !!isDark
    );

    document.documentElement.setAttribute(
        'data-bs-theme',
        isDark ? 'dark' : 'light'
    );
}

// Apply saved theme immediately.
(function () {
    if (localStorage.getItem('theme') === 'dark') {
        applyTheme(true);
    }
})();

// ============================================================
// SHOP LOGO PREVIEW
// ============================================================

function previewShopLogo(event) {
    const file =
        event.target.files?.[0];

    if (!file) return;

    const preview =
        document.getElementById('logoPreview');

    const placeholder =
        document.getElementById(
            'logoPlaceholderText'
        );

    if (!preview) return;

    const reader =
        new FileReader();

    reader.onload = event => {
        preview.src =
            event.target.result;

        preview.style.display =
            'block';

        if (placeholder) {
            placeholder.style.display =
                'none';
        }
    };

    reader.readAsDataURL(file);
}

// ============================================================
// LOGO PREVIEW HELPER
// ============================================================

function showLogoPreview(imageData) {
    const preview =
        document.getElementById('logoPreview');

    const placeholder =
        document.getElementById(
            'logoPlaceholderText'
        );

    if (!preview) return;

    if (!imageData) {
        preview.removeAttribute('src');
        preview.style.display = 'none';

        if (placeholder) {
            placeholder.style.display = 'inline';
        }

        return;
    }

    preview.src = imageData;
    preview.style.display = 'block';

    if (placeholder) {
        placeholder.style.display = 'none';
    }
}

// ============================================================
// UPI QR HELPERS
// ============================================================

function validateQRFile(file) {
    const allowedTypes = [
        'image/png',
        'image/jpeg',
        'image/webp'
    ];

    const maxSize =
        5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
        throw new Error(
            'Please upload a PNG, JPG, JPEG or WEBP QR image.'
        );
    }

    if (file.size > maxSize) {
        throw new Error(
            'QR image must be 5 MB or smaller.'
        );
    }
}

function setUPIPreview(qrImage) {
    const preview =
        document.getElementById('upiQrPreview');

    if (!preview) return;

    if (!qrImage) {
        preview.removeAttribute('src');
        preview.style.display = 'none';
        return;
    }

    // Data URLs should be used directly.
    if (
        typeof qrImage === 'string' &&
        qrImage.startsWith('data:')
    ) {
        preview.src = qrImage;
    } else {
        try {
            preview.src =
                new URL(
                    qrImage,
                    NODE_API
                ).href;
        } catch {
            preview.src = qrImage;
        }
    }

    preview.style.display = 'block';
}

function showSettingsMessage(
    message,
    type = 'info'
) {
    let element =
        document.getElementById(
            'settingsMessage'
        );

    if (!element) {
        element =
            document.createElement('div');

        element.id =
            'settingsMessage';

        const form =
            document.getElementById(
                'settingsForm'
            );

        if (form) {
            form.parentElement.insertBefore(
                element,
                form.parentElement.firstChild
            );
        } else {
            document.body.prepend(element);
        }
    }

    element.className =
        `alert alert-${type} mt-3`;

    element.textContent =
        message;

    clearTimeout(
        element._timer
    );

    element._timer =
        setTimeout(() => {
            element.remove();
        }, 6000);
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}
