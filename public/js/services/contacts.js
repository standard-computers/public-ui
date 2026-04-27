(async () => {
    let selected_contact = {firstname: ""};
    let addContactImageFile = null;
    let editContactImageFile = null;
    let editContactImageChanged = false;
    const contactImageCacheKeys = {};
    const defaultContactImage = "/icons/interfaces/contacts.png";
    const getContactImageCacheKey = (contactId) => {
        const cacheKey = contactImageCacheKeys[String(contactId)];
        return cacheKey ?? "cached";
    };
    const bumpContactImageCacheKey = (contactId) => {
        if (!contactId) return;
        contactImageCacheKeys[String(contactId)] = Date.now();
    };
    const contactImageUrl = (contactId) => contactId ? `/api/records/images/${contactId}?cb=${contactId}-${getContactImageCacheKey(contactId)}` : defaultContactImage;
    const renderNoContactsState = () => div({style: "contacts-empty-state", content: children([
        img({src: defaultContactImage, style: "contacts-empty-icon"}),
        div({style: "contacts-empty-label", content: "No contacts"})
    ])});
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
        const listContainer = contactTile.parentElement;
        contactTile.remove();
        if (listContainer && !listContainer.querySelector(".contact.tile")) {
            renderNoContactsStateInto(listContainer);
        }
    };
    const removeContactFromVisibleLists = (contactId) => {
        const contactIdText = String(contactId || "");
        document.querySelectorAll(".contact.tile").forEach((contactTile) => {
            if (contactTile.getAttribute("data") === contactIdText) {
                removeContactTile(contactTile);
            }
        });
    };
    const applyContactImageBackground = (element, imageUrl = defaultContactImage) => {
        if (!element) return;
        element.style.backgroundImage = `url("${imageUrl}")`;
        element.style.backgroundSize = "cover";
        element.style.backgroundPosition = "center";
        element.style.backgroundRepeat = "no-repeat";
    };
    const deleteContact = (contact = {}, onSuccess = () => {}) => {
        if (!contact.id) {
            modular.error("Missing contact ID");
            return;
        }
        const fullName = [contact.firstname, contact.lastname].filter(Boolean).join(" ").trim() || "this contact";
        confirmationDialogue({title: "Delete Contact", content: `You're sure you want to delete ${fullName}?`, confirmation: async () => {
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
    const openContact = (contact = {}) => {
        const fullName = [contact.firstname, contact.middlename, contact.lastname].filter(Boolean).join(" ").trim() || "View Contact";
        const detailsPortal = new Portal({title: fullName, dimensions: [350, 400], navigation: false, resizable: false,
            tools: [{
                title: "Edit",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.35" stroke="currentColor"><g transform="scale(0.9) translate(1.333 1.333) translate(0.25 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75a2.121 2.121 0 1 1 3 3L9 17.25 4.5 18.75 6 14.25 16.5 3.75Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 5.25l3 3" /></g></svg>`,
                onclick: () => {
                    selected_contact = {...contact};
                    detailsPortal.close();
                    modular.show("com.standard.contacts", 2);
                }
            }, {
                title: "Delete",
                icon: modular.icons.delete,
                onclick: () => {
                    deleteContact(contact, () => {
                        removeContactFromVisibleLists(contact.id);
                        detailsPortal.close();
                    });
                }
            }],
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25" /></svg>`,
            route: () => div({content: children([
                    div({style: "center large-margin-top large-margin-bottom", content: children([img({style: "real-large-icon round inline", src: contactImageUrl(contact.id)})])}),
                    div({style: "small-padding bold large-margin-top", content: fullName}),
                    div({style: "small-padding faded", content: contact.phone || "No phone"}),
                    div({style: "small-padding faded", content: contact.email || "No email"}),
                    div({style: "small-padding", content: contact.address || ""}),
                    div({style: "small-padding faded", content: contact.birthday || ""}),
                ])
            })
        });
        detailsPortal.show();
    };
    window.StandardContacts = window.StandardContacts || {};
    window.StandardContacts.openContact = contact => openContact(contact);
    const contactsPortal = new Portal({title: "Contacts", hints: ["contacts"], dimensions: [400, 500], navigation: false, resizable: false,
            tools: [{
                title: "New Contact",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
                onclick: _ => modular.show("com.standard.contacts", 1),
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25" /></svg>`,
            icon: "/icons/interfaces/contacts.png",
            route: () => div({ style: "large-padding-top", content: children([
                    div({ style : "notes-list", content: div({
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
                                        as.push(div({style: "padded secondary-tile brick line small-spaced hover-shadowed contact tile", data: contact.id, onclick: (e) => {
                                                if (e.target.closest("button")) return;
                                                openContact(contact);
                                            }, content: children([
                                                button({style: "naked inner-radius float-right expose small-padding round",
                                                    icon: `<svg class="small-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
                                                    onclick: (e) => {
                                                        e.stopPropagation();
                                                        deleteContact(contact, () => removeContactTile(e.target.closest(".contact.tile")));
                                                    }
                                                }),
                                                img({style: "icon float-left round space-right cover", src: contactImageUrl(contact.id)}),
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
            afterRender: () => {}
    });
    const addContactPortal = new Portal({title: "Add Contact", hints: ["create contact", "add contact", "add new contact", "create new contact"], dimensions: [350, 450], navigation: false, resizable: false,
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25" /></svg>`,
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
                            div({style: "padded", content: input({id: "birthday", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Address"}),
                            div({style: "padded", content: input({id: "address", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Phone"}),
                            div({style: "padded", content: input({id: "phone", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Email"}),
                            div({style: "padded", content: input({id: "email", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({style: "spacer"}),
                    button({style: "fill fat primary float-right",
                        content: "Create",
                        onclick: async () => {
                            const fname = document.getElementById("first-name").value.trim();
                            const mname = document.getElementById("middle-name").value.trim();
                            const lname = document.getElementById("last-name").value.trim();
                            const bday = document.getElementById("birthday").value.trim();
                            const address = document.getElementById("address").value.trim();
                            const phone = document.getElementById("phone").value.trim();
                            const email = document.getElementById("email").value.trim();
                            try {
                                const response = await CLI.send(`[contacts] + ("${fname}", "${mname}", "${lname}", "${bday}", "${address}", "${phone}", "${email}")`, false);
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
                                    const uploadResponseText = uploadResponse.responseText || "";
                                    if (!uploadResponse.ok) {
                                        modular.error(`Image upload failed (${uploadResponse.status})`);
                                    } else {
                                        bumpContactImageCacheKey(createdContactId);
                                        modular.success("Image uploaded and linked to contact");
                                    }
                                } else if (addContactImageFile && !createdContactId) {
                                    //TODO
                                    console.log("[contacts:create] Image file selected but upload skipped because contact id was not parsed");
                                } else {
                                    //TODO
                                    console.log("[contacts:create] No image selected for upload");
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
                        }
                    }),
                    div({style: "spacer"})
                ])
            }),
            afterRender: () => {
                const photoEl = document.getElementById("add-contact-photo");
                if (!photoEl) return;
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
            }],
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25" /></svg>`,
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
                            div({style: "padded", content: input({id: "edit-birthday", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Address"}),
                            div({style: "padded", content: input({id: "edit-address", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold faded small-padding", content: "Phone"}),
                            div({style: "padded", content: input({id: "edit-phone", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({content: children([
                            div({style: "bold small-padding", content: "Email"}),
                            div({style: "padded", content: input({id: "edit-email", style: "undecorated no-padding", placeholder: ""})})
                        ])
                    }),
                    div({style: "spacer"}),
                    button({style: "fill fat primary float-right", content: "Save", onclick: async () => {
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
                            const escaped = value => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\\"');
                            try {
                                const updates = [
                                    CLI.send(`[contacts] firstname "${escaped(fname)}" <id ${contactId}>`),
                                    CLI.send(`[contacts] middlename "${escaped(mname)}" <id ${contactId}>`),
                                    CLI.send(`[contacts] lastname "${escaped(lname)}" <id ${contactId}>`),
                                    CLI.send(`[contacts] birthday "${escaped(bday)}" <id ${contactId}>`),
                                    CLI.send(`[contacts] address "${escaped(address)}" <id ${contactId}>`),
                                    CLI.send(`[contacts] phone "${escaped(phone)}" <id ${contactId}>`),
                                    CLI.send(`[contacts] email "${escaped(email)}" <id ${contactId}>`)
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
                            selected_contact = {...selected_contact, id: contactId, firstname: fname, middlename: mname, lastname: lname, birthday: bday, address, phone, email};
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
                        }}),
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
                setValue("edit-birthday", selected_contact.birthday);
                setValue("edit-address", selected_contact.address);
                setValue("edit-phone", selected_contact.phone);
                setValue("edit-email", selected_contact.email);
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
