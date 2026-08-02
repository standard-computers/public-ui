(async () => {

    let selected_contact = {firstname: ""};
    let addContactImageFile = null;
    let editContactImageFile = null;
    let editContactImageChanged = false;
    const contactImageCacheKeys = {};
    const contactServiceIcon = "/icons/interfaces/contacts.png";
    const defaultContactImage = "/images/blank_contact.png";

    const getContactImageCacheKey = (contactId) => {
        const cacheKey = contactImageCacheKeys[String(contactId)];
        return cacheKey ?? "cached";
    };

    const bumpContactImageCacheKey = (contactId) => {
        if (!contactId) return;
        contactImageCacheKeys[String(contactId)] = Date.now();
    };

    const contactImageUrl = (contactId) => contactId ? `/api/records/images/${contactId}?cb=${contactId}-${getContactImageCacheKey(contactId)}` : defaultContactImage;

    const setContactImageFallback = (imageEl) => {
        if (!imageEl || imageEl.src.endsWith(defaultContactImage)) return;
        imageEl.src = defaultContactImage;
    };

    document.addEventListener("error", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement) || !target.classList.contains("contact-image")) return;
        setContactImageFallback(target);
    }, true);

    const contactPreviewContacts = new Map();
    const renderNoContactsState = () => emptyState({style: "contacts-empty-state", icon: contactServiceIcon, iconStyle: "contacts-empty-icon", label: "No contacts", labelStyle: "contacts-empty-label"});

    const renderNoContactsStateInto = (container) => {
        if (!container) return;
        const emptyStateMarkup = renderNoContactsState();
        if (typeof createMarkupNode === "function") {
            const emptyState = createMarkupNode(emptyStateMarkup);
            if (emptyState) {
                container.replaceChildren(emptyState);
                return;
            }
        }
        container.innerHTML = emptyStateMarkup;
    };

    const removeContactTile = (contactTile) => {
        if (!contactTile) return;
        const contactIdText = String(contactTile.getAttribute("data") || "");
        const listContainer = contactTile.parentElement;
        contactTile.remove();
        contactPreviewContacts.delete(contactIdText);
        if (contactPreview.activeTile === contactTile) hideContactPreview();
        if (listContainer && !listContainer.querySelector(".contact.tile")) renderNoContactsStateInto(listContainer);
    };

    const removeContactFromVisibleLists = (contactId) => {
        const contactIdText = String(contactId || "");
        document.querySelectorAll(".contact.tile").forEach((contactTile) => {
            if (contactTile.getAttribute("data") === contactIdText) removeContactTile(contactTile);
        });
        contactPreviewContacts.delete(contactIdText);
        if (contactPreview.activeTile?.getAttribute("data") === contactIdText) hideContactPreview();
    };

    const setContactImageBackground = (element, imageUrl = defaultContactImage) => {
        if (!element) return;
        element.dataset.contactImageSource = imageUrl;
        element.style.backgroundImage = `url("${imageUrl}")`;
        element.style.backgroundSize = "cover";
        element.style.backgroundPosition = "center";
        element.style.backgroundRepeat = "no-repeat";
    };

    const applyContactImageBackground = (element, imageUrl = defaultContactImage) => {
        const resolvedImageUrl = imageUrl || defaultContactImage;
        setContactImageBackground(element, resolvedImageUrl);
        if (!resolvedImageUrl || resolvedImageUrl === defaultContactImage || resolvedImageUrl.startsWith("blob:")) return;
        const probe = new Image();
        probe.onerror = () => {
            if (element?.dataset?.contactImageSource === resolvedImageUrl) setContactImageBackground(element, defaultContactImage);
        };
        probe.src = resolvedImageUrl;
    };

    const buildContactPreview = () => {
        const preview = document.createElement("div");
        preview.className = "contacts-hover-preview";
        Object.assign(preview.style, {position: "fixed", display: "none", zIndex: "91100", width: "240px", maxWidth: "calc(100vw - 24px)", boxSizing: "border-box", padding: "10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--secondary-bg)", color: "var(--fg)", boxShadow: "var(--shadow)", pointerEvents: "none"});
        const header = document.createElement("div");
        Object.assign(header.style, {display: "grid", gridTemplateColumns: "44px minmax(0, 1fr)", gap: "10px", alignItems: "center", marginBottom: "8px"});
        const photo = document.createElement("img");
        photo.className = "contacts-hover-preview-photo contact-image";
        Object.assign(photo.style, {width: "44px", height: "44px", borderRadius: "999px", objectFit: "cover", background: "var(--bg)"});
        const nameWrap = document.createElement("div");
        nameWrap.style.minWidth = "0";
        const name = document.createElement("div");
        name.className = "contacts-hover-preview-name";
        Object.assign(name.style, {fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"});
        const birthday = document.createElement("div");
        birthday.className = "contacts-hover-preview-birthday";
        Object.assign(birthday.style, {opacity: "0.7", fontSize: "calc(var(--fs) - 3px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"});
        nameWrap.append(name, birthday);
        header.append(photo, nameWrap);
        const details = document.createElement("div");
        details.className = "contacts-hover-preview-details";
        Object.assign(details.style, {display: "grid", gap: "4px", fontSize: "calc(var(--fs) - 2px)"});
        ["company", "phone", "email", "address"].forEach(field => {
            const row = document.createElement("div");
            row.className = `contacts-hover-preview-${field}`;
            Object.assign(row.style, {opacity: "0.82", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: field === "address" ? "normal" : "nowrap", overflowWrap: "anywhere"});
            details.appendChild(row);
        });
        preview.append(header, details);
        document.body.appendChild(preview);
        return preview;
    };

    const contactPreview = {element: null, activeTile: null, pendingEvent: null, frame: null};

    const ensureContactPreview = () => {
        if (!contactPreview.element || !document.body.contains(contactPreview.element)) contactPreview.element = buildContactPreview();
        return contactPreview.element;
    };

    const formatContactName = (contact = {}) => [contact.firstname, contact.middlename, contact.lastname].filter(Boolean).join(" ").trim() || "Unnamed Contact";

    const updateContactPreviewContent = (tile, contact = {}) => {
        const preview = ensureContactPreview();
        const previewPhoto = preview.querySelector(".contacts-hover-preview-photo");
        const sourcePhoto = tile?.querySelector("img");
        if (previewPhoto) {
            previewPhoto.src = sourcePhoto?.currentSrc || sourcePhoto?.src || defaultContactImage;
            previewPhoto.alt = "";
        }
        const setText = (selector, value) => {
            const element = preview.querySelector(selector);
            if (!element) return;
            const text = String(value || "").trim();
            element.textContent = text;
            element.style.display = text ? "" : "none";
        };
        setText(".contacts-hover-preview-name", formatContactName(contact));
        setText(".contacts-hover-preview-birthday", contact.birthday);
        setText(".contacts-hover-preview-company", contact.company);
        setText(".contacts-hover-preview-phone", contact.phone);
        setText(".contacts-hover-preview-email", contact.email);
        setText(".contacts-hover-preview-address", contact.address);
    };

    const moveContactPreview = (event) => {
        const preview = ensureContactPreview();
        const margin = 12;
        const offset = 16;
        let left = event.clientX + offset;
        let top = event.clientY + offset;
        const rect = preview.getBoundingClientRect();
        if (left + rect.width + margin > window.innerWidth) left = event.clientX - rect.width - offset;
        if (top + rect.height + margin > window.innerHeight) top = event.clientY - rect.height - offset;
        preview.style.left = `${Math.max(margin, left)}px`;
        preview.style.top = `${Math.max(margin, top)}px`;
    };

    const scheduleContactPreviewMove = (event) => {
        contactPreview.pendingEvent = event;
        if (contactPreview.frame) return;
        contactPreview.frame = requestAnimationFrame(() => {
            contactPreview.frame = null;
            if (!contactPreview.pendingEvent) return;
            moveContactPreview(contactPreview.pendingEvent);
        });
    };

    const showContactPreview = (tile, event) => {
        if (!tile) return;
        const contact = contactPreviewContacts.get(String(tile.getAttribute("data") || ""));
        if (!contact) return;
        contactPreview.activeTile = tile;
        updateContactPreviewContent(tile, contact);
        const preview = ensureContactPreview();
        preview.style.display = "block";
        moveContactPreview(event);
    };

    const hideContactPreview = () => {
        if (contactPreview.frame) cancelAnimationFrame(contactPreview.frame);
        contactPreview.frame = null;
        contactPreview.pendingEvent = null;
        contactPreview.activeTile = null;
        if (contactPreview.element) contactPreview.element.style.display = "none";
    };

    document.addEventListener("mouseover", (event) => {
        const tile = event.target.closest?.(".contact.tile");
        if (!tile || tile === contactPreview.activeTile) return;
        showContactPreview(tile, event);
    });

    document.addEventListener("mousemove", (event) => {
        if (!contactPreview.activeTile) return;
        const tile = event.target.closest?.(".contact.tile");
        if (tile !== contactPreview.activeTile) return;
        scheduleContactPreviewMove(event);
    });

    document.addEventListener("mouseout", (event) => {
        if (!contactPreview.activeTile) return;
        const relatedTarget = event.relatedTarget;
        if (relatedTarget instanceof Node && contactPreview.activeTile.contains(relatedTarget)) return;
        const leavingTile = event.target.closest?.(".contact.tile");
        if (leavingTile === contactPreview.activeTile) hideContactPreview();
    });

    window.addEventListener("blur", hideContactPreview);
    window.addEventListener("scroll", hideContactPreview, true);
    const deleteContact = (contact = {}, onSuccess = () => {}) => {
        if (!contact.id) {
            modular.error("Missing contact ID");
            return;
        }
        const fullName = [contact.firstname, contact.lastname].filter(Boolean).join(" ").trim() || "this contact";
        confirmationDialogue({
            title: "Delete Contact",
            destructive: true,
            content: `You're sure you want to delete ${fullName}?`,
            confirmation: async () => {
                try {
                    const response = await CLI.send(`[contacts] - <id ${contact.id}>`);
                    if (response !== 0) {
                        if (selected_contact.id === contact.id) selected_contact = {firstname: ""};
                        try {
                            onSuccess();
                        } catch (error) {
                            console.error("[contacts:delete] Contact deleted but list cleanup failed", error);
                        }
                        modular.success("Deleted contact");
                    } else {
                        modular.error("Failed to delete contact");
                    }
                } catch (error) {
                    modular.error("Failed to delete contact");
                }
            }
        });
    };

    const closeCreateContactPortal = () => {
        const openPortalWindow = typeof modular?.findPortalWindow === "function" ? modular.findPortalWindow("com.standard.contacts", 1) : null;
        if (typeof openPortalWindow?.portal?.close === "function") {
            openPortalWindow.portal.close();
            return true;
        }
        if (typeof openPortalWindow?.portal?.hide === "function") {
            openPortalWindow.portal.hide();
            return true;
        }
        return false;
    };

    const closeEditContactPortal = () => {
        const openPortalWindow = typeof modular?.findPortalWindow === "function" ? modular.findPortalWindow("com.standard.contacts", 2) : null;
        if (typeof openPortalWindow?.portal?.close === "function") {
            openPortalWindow.portal.close();
            return true;
        }
        if (typeof openPortalWindow?.portal?.hide === "function") {
            openPortalWindow.portal.hide();
            return true;
        }
        return false;
    };

    const resetPhotoPickerBinding = (photoEl, bindingKey) => {
        if (!photoEl) return null;
        const previousBinding = photoEl[bindingKey];
        if (previousBinding?.input?.remove) previousBinding.input.remove();
        if (typeof previousBinding?.objectUrl === "string") URL.revokeObjectURL(previousBinding.objectUrl);
        photoEl.onclick = null;
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);
        const binding = {input: fileInput, objectUrl: null};
        photoEl[bindingKey] = binding;
        return binding;
    };

    const createContact = async () => {
        const fname = document.getElementById("first-name").value.trim();
        const mname = document.getElementById("middle-name").value.trim();
        const lname = document.getElementById("last-name").value.trim();
        const bday = document.getElementById("birthday").value.trim();
        const address = document.getElementById("address").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const email = document.getElementById("email").value.trim();
        const company = document.getElementById("company").value.trim();
        try {
            const response = await CLI.send(`[contacts] + ("${fname}", "${mname}", "${lname}", "${bday}", "${address}", "${phone}", "${email}", "${company}")`, false);
            const createdContactId = response;
            if (!createdContactId) modular.error("Contact was created but no record ID was parsed; image upload skipped");
            if (addContactImageFile && createdContactId) {
                const formData = new FormData();
                formData.append("file", addContactImageFile);
                const uploadResponse = typeof window.StandardUploads?.uploadFile === "function"
                    ? await window.StandardUploads.uploadFile(addContactImageFile, `/api/upload/temp/${createdContactId}`, {
                        label: `Uploading ${addContactImageFile.name || "contact photo"}`
                    })
                    : await fetch(`/api/upload/temp/${createdContactId}`, {
                        method: "POST",
                        body: formData
                    }).then(async response => ({
                        ok: response.ok,
                        status: response.status,
                        responseText: await response.text()
                    }));
                if (!uploadResponse.ok) {
                    modular.error(`Image upload failed (${uploadResponse.status})`);
                } else {
                    bumpContactImageCacheKey(createdContactId);
                    modular.success("Image uploaded and linked to contact");
                }
            } else if (addContactImageFile && !createdContactId) {
                //TODO
            } else {
                //TODO
            }
            if ((response !== 0) || createdContactId) {
                addContactImageFile = null;
                closeCreateContactPortal();
                modular.refresh("com.standard.contacts");
                modular.success("Created contact");
            } else {
                modular.error("Failed to create contact");
            }
        } catch (error) {
            modular.error("Failed to create contact or upload image");
        }
    };

    const saveSelectedContact = async () => {
        const contactId = selected_contact?.id;
        if (!contactId) {
            modular.error("No contact selected");
            return;
        }
        const fname = document.getElementById("edit-first-name").value.trim();
        const mname = document.getElementById("edit-middle-name").value.trim();
        const lname = document.getElementById("edit-last-name").value.trim();
        const bday = document.getElementById("edit-birthday").value.trim();
        const address = document.getElementById("edit-address").value.trim();
        const phone = document.getElementById("edit-phone").value.trim();
        const email = document.getElementById("edit-email").value.trim();
        const company = document.getElementById("edit-company").value.trim();
        const escaped = value => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\\"');
        try {
            const updates = [
                CLI.send(`[contacts] firstname "${escaped(fname)}" <id ${contactId}>`),
                CLI.send(`[contacts] middlename "${escaped(mname)}" <id ${contactId}>`),
                CLI.send(`[contacts] lastname "${escaped(lname)}" <id ${contactId}>`),
                CLI.send(`[contacts] birthday "${escaped(bday)}" <id ${contactId}>`),
                CLI.send(`[contacts] address "${escaped(address)}" <id ${contactId}>`),
                CLI.send(`[contacts] phone "${escaped(phone)}" <id ${contactId}>`),
                CLI.send(`[contacts] email "${escaped(email)}" <id ${contactId}>`),
                CLI.send(`[contacts] company "${escaped(company)}" <id ${contactId}>`)
            ];
            const updateResponses = await Promise.all(updates);
            const hadUpdateFailure = updateResponses.some(response => response === 0);
            if (hadUpdateFailure) {
                modular.error("Failed to update one or more fields");
                return;
            }
            if (editContactImageChanged && editContactImageFile) {
                const formData = new FormData();
                formData.append("file", editContactImageFile);
                const uploadResponse = typeof window.StandardUploads?.uploadFile === "function" ? await window.StandardUploads.uploadFile(editContactImageFile, `/api/upload/temp/${contactId}`, {label: `Uploading ${editContactImageFile.name || "contact photo"}`}) : await fetch(`/api/upload/temp/${contactId}`, {method: "POST", body: formData}).then(response => ({ok: response.ok, status: response.status}));
                if (!uploadResponse.ok) {
                    modular.error(`Image upload failed (${uploadResponse.status})`);
                    return;
                }
                bumpContactImageCacheKey(contactId);
            }
        } catch (error) {
            modular.error("Failed to save contact");
            return;
        }
        selected_contact = {...selected_contact, id: contactId, firstname: fname, middlename: mname, lastname: lname, birthday: bday, address, phone, email, company};
        try {
            editContactImageFile = null;
            editContactImageChanged = false;
            closeEditContactPortal();
            modular.refresh("com.standard.contacts");
            openContact(selected_contact);
            modular.success("Saved contact");
        } catch (error) {
            console.error("[contacts:save] Contact saved but portal transition failed", error);
            modular.refresh("com.standard.contacts");
            modular.success("Saved contact");
        }
    };

    const openContact = (contact = {}) => {
        const fullName = [contact.firstname, contact.middlename, contact.lastname].filter(Boolean).join(" ").trim() || "View Contact";
        const contactValue = (value) => String(value || "").trim();
        const phone = contactValue(contact.phone);
        const email = contactValue(contact.email);
        const contactActions = [
            phone && button({
                style: "naked small-padding round background-secondary" + (email ? " margin-right" : ""),
                title: `Call ${fullName}`,
                icon: modular.icons.phone,
                onclick: () => window.location.href = `tel:${phone}`
            }),
            email && button({
                style: "naked small-padding round background-secondary",
                title: `Email ${fullName}`,
                icon: modular.icons.email,
                onclick: () => window.location.href = `mailto:${email}`
            })
        ].filter(Boolean);

        const contactDetails = [
            contactValue(contact.company) && div({style: "small-padding faded", content: contactValue(contact.company)}),
            phone && div({style: "small-padding faded", content: phone}),
            email && div({style: "small-padding faded", content: email}),
            contactValue(contact.address) && div({style: "small-padding", content: contactValue(contact.address).replace(/\s*,\s*/g, "<br>")}),
            contactValue(contact.birthday) && div({style: "small-padding faded", content: contactValue(contact.birthday)})
        ].filter(Boolean);

        const detailsPortal = new Portal({title: fullName, dimensions: [350, 400], auto_height: true, navigation: false, resizable: false,
            tools: [
                {
                    title: "Edit",
                    icon: modular.icons.modify,
                    onclick: () => {
                        selected_contact = {...contact};
                        detailsPortal.close();
                        modular.show("com.standard.contacts", 2);
                    }
                },
                {
                    title: "Delete",
                    icon: modular.icons.delete,
                    onclick: () => {
                        deleteContact(contact, () => {
                            removeContactFromVisibleLists(contact.id);
                            detailsPortal.close();
                        });
                    }
                }
            ],
            icon: modular.icons.at,
            route: () => div({content: children([
                    div({style: "center large-margin-top large-margin-bottom", content: children([
                        img({style: "contact-image real-large-icon round inline", src: contactImageUrl(contact.id)}),
                        contactActions.length && div({style: "center small-padding", content: children(contactActions)})
                    ].filter(Boolean))}),
                    div({style: "small-padding bold large-margin-top", content: fullName}),
                    ...contactDetails,
                ])
            })
        });
        detailsPortal.show();
    };

    window.StandardContacts = window.StandardContacts || {};
    window.StandardContacts.openContact = contact => openContact(contact);
    const getContactFromTile = (tile) => contactPreviewContacts.get(String(tile?.getAttribute("data") || ""));
    const bindContactsListContextMenu = () => {
        const contactsList = document.getElementById("contacts-list");
        if (!contactsList || contactsList.dataset.contextMenuBound === "1") return;
        contactsList.dataset.contextMenuBound = "1";
        contactsList.addEventListener("contextmenu", hideContactPreview);
        const hasContactTarget = (_root, target) => !!target?.closest?.(".contact.tile");
        contactsList.contextmenu([{
            icon: modular.icons.open,
            label: "Open",
            visible: hasContactTarget,
            action: (_root, _event, tile) => {
                const contact = getContactFromTile(tile);
                if (contact) openContact(contact);
            }
        }, {
            icon: modular.icons.modify,
            label: "Edit",
            visible: hasContactTarget,
            action: (_root, _event, tile) => {
                const contact = getContactFromTile(tile);
                if (!contact) return;
                selected_contact = {...contact};
                modular.show("com.standard.contacts", 2);
            }
        }, {
            icon: modular.icons.delete,
            label: "Delete",
            destructive: true,
            visible: hasContactTarget,
            action: (_root, _event, tile) => {
                const contact = getContactFromTile(tile);
                if (contact) deleteContact(contact, () => removeContactTile(tile));
            }
        }], ".contact.tile");
    };
    const contactsPortal = new Portal({
        title: "Contacts",
        hints: ["contacts"],
        dimensions: [400, 500],
        navigation: false,
        resizable: false,
        tools: [{
            title: "New Contact",
            icon: modular.icons.create,
            onclick: _ => modular.show("com.standard.contacts", 1),
        }],
        svg_icon: modular.icons.at,
        icon: "/icons/interfaces/contacts.png",
        route: () => div({ style: "large-padding-top", content: children([
                div({ id: "contacts-list", style : "notes-list", content: div({
                        style: "padded", content: () => {
                            return CLI.send("[contacts]").then(d => {
                                const contacts = d === 0 ? [] : d.contacts;
                                if (!Array.isArray(contacts)) throw new Error("Invalid contacts response");
                                if (contacts.length === 0) return renderNoContactsState();
                                const sortedContacts = [...contacts].sort((left, right) => {
                                    const leftName = String(left?.firstname || "").trim();
                                    const rightName = String(right?.firstname || "").trim();
                                    return leftName.localeCompare(rightName, undefined, {sensitivity: "base"});
                                });
                                let as = []
                                for (let i = 0; i < sortedContacts.length; i++) {
                                    const contact = sortedContacts[i];
                                    contactPreviewContacts.set(String(contact.id), contact);
                                    as.push(div({style: "padded secondary-tile brick line small-spaced hover-shadowed contact tile", data: contact.id, onclick: (e) => {
                                            if (e.target.closest("button")) return;
                                            openContact(contact);
                                        }, content: children([
                                            button({style: "naked inner-radius float-right expose small-padding round", icon: modular.icons.delete,
                                                onclick: (e) => {
                                                    e.stopPropagation();
                                                    deleteContact(contact, () => removeContactTile(e.target.closest(".contact.tile")));
                                                }
                                            }),
                                            img({style: "contact-image icon float-left round space-right cover", src: contactImageUrl(contact.id)}),
                                            label({content: contact.firstname}),
                                            div({style: "faded", content: contact.lastname}),
                                        ])
                                    }))
                                }
                                return children(as);
                            })
                        }
                    })
                })
            ])
        }),
        afterRender: bindContactsListContextMenu
    });

    const addContactPortal = new Portal({
        title: "Add Contact",
        hints: ["create contact", "add contact", "add new contact", "create new contact"],
        dimensions: [350, 450],
        navigation: false,
        resizable: false,
        tools: [{
            title: "Save",
            icon: modular.icons.save,
            onclick: createContact
        }],
        icon: modular.icons.at,
        route: () => div({content: children([
                div({style: "center medium-margin-top margin-bottom", content: children([
                        div({style: "background-secondary round real-large-icon inline medium-margin-top margin-bottom" , id: "add-contact-photo"})
                    ])
                }),
                div({content: children([
                        div({style: "bold small-padding", content: "First Name"}),
                        div({style: "padded", content: input({id: "first-name", style: "undecorated no-padding", placeholder: ""})})
                    ])
                }),
                div({content: children([
                        div({style: "bold small-padding", content: "Middle"}),
                        div({style: "padded", content: input({id: "middle-name", style: "undecorated no-padding", placeholder: ""})})
                    ])
                }),
                div({content: children([
                        div({style: "bold small-padding", content: "Last"}),
                        div({style: "padded", content: input({id: "last-name", style: "undecorated no-padding", placeholder: ""})})
                    ])
                }),
                div({content: children([
                        div({style: "bold small-padding", content: "Birthday"}),
                        div({style: "padded", content: dateInput({id: "birthday", style: "undecorated no-padding"})})
                    ])
                }),
                div({content: children([
                        div({style: "bold small-padding", content: "Address"}),
                        div({style: "padded", content: input({id: "address", style: "undecorated no-padding", placeholder: ""})})
                    ])
                }),
                div({content: children([
                        div({style: "bold small-padding", content: "Phone"}),
                        div({style: "padded", content: phoneInput({id: "phone", style: "undecorated no-padding"})})
                    ])
                }),
                div({content: children([
                        div({style: "bold small-padding", content: "Email"}),
                        div({style: "padded", content: input({id: "email", style: "undecorated no-padding", placeholder: ""})})
                    ])
                }),
                div({content: children([
                        div({style: "bold small-padding", content: "Company"}),
                        div({style: "padded", content: input({id: "company", style: "undecorated no-padding", placeholder: "Standard Computers LLC"})})
                    ])
                }),
                div({style: "spacer"})
            ])
        }),
        afterRender: () => {
            const photoEl = document.getElementById("add-contact-photo");
            if (!photoEl) return;
            applyContactImageBackground(photoEl, defaultContactImage);
            const binding = resetPhotoPickerBinding(photoEl, "__addContactPhotoPicker");
            const fileInput = binding?.input;
            if (!fileInput) return;
            photoEl.style.cursor = "pointer";
            photoEl.onclick = () => fileInput.click();
            fileInput.onchange = () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                if (!file.type || !file.type.startsWith("image/")) {
                    addContactImageFile = null;
                    fileInput.value = "";
                    return;
                }
                addContactImageFile = file;
                if (binding.objectUrl) URL.revokeObjectURL(binding.objectUrl);
                binding.objectUrl = URL.createObjectURL(file);
                applyContactImageBackground(photoEl, binding.objectUrl);
                fileInput.value = "";
            };
        }
    });

    const editContactPortal = new Portal({
        title: "Edit Contact",
            dimensions: [350, 450],
            navigation: false,
            tools: [{
                title: "Delete",
                icon: modular.icons.delete,
                onclick: () => {
                    const contactId = selected_contact?.id;
                    deleteContact(selected_contact, () => {
                        removeContactFromVisibleLists(contactId);
                        closeEditContactPortal();
                    });
                }
            }, {
                title: "Save",
                icon: modular.icons.save,
                onclick: saveSelectedContact
            }],
            icon: modular.icons.at,
            route: () => div({content: children([
                    div({style: "center medium-margin-top margin-bottom", content: children([
                            div({style: "background-secondary round real-large-icon inline medium-margin-top margin-bottom" , id: "edit-contact-photo"})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "First Name"}),
                            div({style: "padded", content: input({id: "edit-first-name", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Middle"}),
                            div({style: "padded", content: input({id: "edit-middle-name", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Last"}),
                            div({style: "padded", content: input({id: "edit-last-name", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Birthday"}),
                            div({style: "padded", content: dateInput({id: "edit-birthday", style: "undecorated no-padding", value: selected_contact.birthday})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Address"}),
                            div({style: "padded", content: input({id: "edit-address", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold faded small-padding", content: "Phone"}),
                            div({style: "padded", content: phoneInput({id: "edit-phone", style: "undecorated no-padding", value: selected_contact.phone})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Email"}),
                            div({style: "padded", content: input({id: "edit-email", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Company"}),
                            div({style: "padded", content: input({id: "edit-company", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({style: "spacer"})
                ])
            }),
            afterRender: () => {
                const photoEl = document.getElementById("edit-contact-photo");
                const setValue = (id, value) => {
                    const field = document.getElementById(id);
                    if (field) field.value = value || "";
                };
                setValue("edit-first-name", selected_contact.firstname);
                setValue("edit-middle-name", selected_contact.middlename);
                setValue("edit-last-name", selected_contact.lastname);
                setValue("edit-address", selected_contact.address);
                setValue("edit-email", selected_contact.email);
                setValue("edit-company", selected_contact.company);
                if (photoEl) {
                    applyContactImageBackground(photoEl, contactImageUrl(selected_contact.id));
                    photoEl.style.cursor = "pointer";
                    editContactImageFile = null;
                    editContactImageChanged = false;
                    const binding = resetPhotoPickerBinding(photoEl, "__editContactPhotoPicker");
                    const fileInput = binding?.input;
                    if (!fileInput) return;
                    photoEl.onclick = () => fileInput.click();
                    fileInput.onchange = () => {
                        const file = fileInput.files && fileInput.files[0];
                        if (!file) return;
                        if (!file.type || !file.type.startsWith("image/")) {
                            editContactImageFile = null;
                            editContactImageChanged = false;
                            fileInput.value = "";
                            return;
                        }
                        editContactImageFile = file;
                        editContactImageChanged = true;
                        if (binding.objectUrl) URL.revokeObjectURL(binding.objectUrl);
                        binding.objectUrl = URL.createObjectURL(file);
                        applyContactImageBackground(photoEl, binding.objectUrl);
                        fileInput.value = "";
                    };
                }
            }
    });
    modular.register(new Service("com.standard.contacts", [contactsPortal, addContactPortal, editContactPortal]));
})();
