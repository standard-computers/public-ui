let modular = {
    windowFocusSetup: false,
    highestZ: 1000,
    minimized: 0,
    lastPointerPosition: null,
    lastClickPosition: null,
    widgetDockPosition: "bottom-right",
    titleMessageRestoreTimer: null,
    titleMessageOriginal: null,
    widgets: [],
    working_directory: "Documents",
    colors: [
        {name: "Pure Blood", color: "#F71735", secondary: "#AF1807"},
        {name: "Scarlet", color: "#FE0000", secondary: "#E21807"},
        {name: "Red", color: "#E21807", secondary: "#AF1807"},
        {name: "Brick", color: "#A01823", secondary: "#B11B27"},
        {name: "Burnt Orange", color: "#F2542D", secondary: "#F26D2D"},
        {name: "Bright Orange", color: "#FF4523", secondary: "#bb3216"},
        {name: "Orange", color: "#F28123", secondary: "#F48A23"},
        {name: "Yellow", color: "#FFD23F", secondary: "#FFE13F"},
        {name: "Warm Yellow", color: "#FFC13D", secondary: "#F7C04A"},
        {name: "Mustard", color: "#EFCA08", secondary: "#d7b607"},
        {name: "Fungi", color: "#38A169", secondary: "#2FAE69"},
        {name: "Chill", color: "#138A36", secondary: "#039419"},
        {name: "Nice Green", color: "#1EB533", secondary: "#1ED02B"},
        {name: "Sea Green", color: "#00A6A6", secondary: "#028181"},
        {name: "Baby Azul", color: "#00A7E1", secondary: "#00A7FF"},
        {name: "Blue Green", color: "#07A0C3", secondary: "#0583c5"},
        {name: "Standard Blue", color: "#0c92c2", secondary: "#0583c5"},
        {name: "Sapphire Blue", color: "#1C6E8C", secondary: "#1C83A4"},
        {name: "Purple Blue", color: "#345995", secondary: "#4271be"},
        {name: "Facebook Blue", color: "#0066F1", secondary: "#1977F1"},
        {name: "Hard Blue", color: "#0000FF", secondary: "#002BFF"},
        {name: "Night Blue", color: "#011470", secondary: "#001587"},
        {name: "Pink", color: "#EE4266", secondary: "#EE5D98"},
        {name: "Coral", color: "#FF6663", secondary: "#FD8684"},
        {name: "Barbie Pink", color: "#D72483", secondary: "#EE3483"},
        {name: "Magenta", color: "#CB429F", secondary: "#E64EAA"},
        {name: "Ruby", color: "#D81E5B", secondary: "#E64B7A"},
        {name: "Light Plum", color: "#9448BC", secondary: "#B630DB"},
        {name: "Purple", color: "#5F0A87", secondary: "#6E2EA0"},
        {name: "Midnight", color: "#0d0564", secondary: "#120a7e"},
        {name: "Black", color: "#000000", secondary: "#323232"},
        {name: "Black", color: "#272727", secondary: "#353535"},
        {name: "Coffee", color: "#653837", secondary: "#6F4824"},
        {name: "Dark Slate", color: "#28464B", secondary: "#28464B"},
        {name: "Concrete", color: "#728095", secondary: "#7F8C9A"},
        {name: "Off", color: "#ededed", secondary: "#d1d1d1"},
        {name: "Normal", color: "#fff", secondary: "#EEEEEE"},
        {name: "Dark Gray", color: "darkgray", secondary: "#d3d3d3"},
    ],
    icons: {
        at: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25"/></svg>`,
        articles: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"/></svg>`,
        bold: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 5.7519531 2.0039062 A 0.750075 0.750075 0 0 0 5.0019531 2.7539062 L 5.0019531 11.703125 A 0.750075 0.750075 0 0 0 5.0019531 11.757812 L 5.0078125 21.257812 A 0.750075 0.750075 0 0 0 5.7578125 22.007812 L 13.505859 22.007812 C 16.534311 22.007812 19.005859 19.536265 19.005859 16.507812 C 19.005859 14.261755 17.639043 12.332811 15.701172 11.480469 C 17.057796 10.528976 18.005859 9.0314614 18.005859 7.2558594 C 18.005859 4.3643887 15.645377 2.0039063 12.753906 2.0039062 L 5.7519531 2.0039062 z M 6.5019531 3.5039062 L 12.753906 3.5039062 C 14.834436 3.5039063 16.505859 5.17533 16.505859 7.2558594 C 16.505859 9.3363887 14.834436 11.007813 12.753906 11.007812 L 6.5019531 11.007812 L 6.5019531 3.5039062 z M 6.5019531 12.507812 L 12.753906 12.507812 L 13.505859 12.507812 C 15.723408 12.507812 17.505859 14.290264 17.505859 16.507812 C 17.505859 18.725361 15.723408 20.507812 13.505859 20.507812 L 6.5058594 20.507812 L 6.5019531 12.507812 z"/></svg>`,
        brush: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"/></svg>`,
        center: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M7 10.5h10M4 14.5h16M7 18.5h10"/></svg>`,
        chart: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"/></svg>`,
        create: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`,
        delete: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>`,
        diamond: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linejoin="round" d="M12 3 21 12 12 21 3 12 12 3Z"/></svg>`,
        ellipse: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><ellipse cx="12" cy="12" rx="8" ry="5.5"/></svg>`,
        ellipses: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></svg>`,
        email: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>`,
        film: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5"/></svg>`,
        globe: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>`,
        italic: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 10 2.0078125 L 10 3.5078125 L 10.75 3.5078125 L 13.119141 3.5078125 L 9.3417969 20.503906 L 6.7558594 20.503906 L 6.0058594 20.503906 L 6.0058594 22.003906 L 6.7558594 22.003906 L 13.2558594 22.003906 L 14.0058594 22.003906 L 14.0058594 20.503906 L 13.2558594 20.503906 L 10.878906 20.503906 L 14.65625 3.5078125 L 17.25 3.5078125 L 18 3.5078125 L 18 2.0078125 L 17.25 2.0078125 L 10.75 2.0078125 L 10 2.0078125 z"/></svg>`,
        image: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>`,
        left: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M4 10.5h10M4 14.5h16M4 18.5h10"/></svg>`,
        link: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" style="fill:none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path fill="none" style="fill:none" stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg>`,
        modify: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon very-small-padding" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"/></svg>`,
        note: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`,
        open: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"/></svg>`,
        pdf: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linejoin="round" d="M6 2.75h8l4 4v14.5H6zM14 2.75v4h4"/><path stroke-linecap="round" d="M8.5 16.5v-5h1.25a1.5 1.5 0 0 1 0 3H8.5m4-3h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1zm5 5v-5h2.5m-2.5 2h2"/></svg>`,
        phone: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102A1.125 1.125 0 0 0 5.872 2.25H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></svg>`,
        play: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/></svg>`,
        print: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon very-small-padding" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"/></svg>`,
        rectangle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="4" y="6" width="16" height="12" rx="1.5"/></svg>`,
        refresh: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>`,
        right: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M10 10.5h10M4 14.5h16M10 18.5h10"/></svg>`,
        rounded_rectangle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="4" y="6" width="16" height="12" rx="4"/></svg>`,
        save: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>`,
        search: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon very-small-padding" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>`,
        shapes: `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="3.75" y="4.5" width="7.5" height="7.5" rx="1.25"/><circle cx="16.75" cy="8.25" r="3.75"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 19.5h12l-6-6-6 6Z"/></svg>`,
        sheets: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"/></svg>`,
        sort: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon very-small-padding" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"/></svg>`,
        text: `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 6.75h15M12 6.75v10.5m-3.75 0h7.5"/></svg>`,
        tag: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z"/></svg>`,
        triangle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linejoin="round" d="M12 4 21 20H3L12 4Z"/></svg>`,
        underline: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 6.0058594 2 L 6.0058594 2.75 L 6.0058594 12.585938 C 6.0058594 15.618894 8.7446099 18.001953 12.003906 18.001953 C 15.263203 18.001953 18.003906 15.618893 18.003906 12.585938 L 18.003906 2.75 L 18.003906 2 L 16.503906 2 L 16.503906 2.75 L 16.503906 12.585938 C 16.503906 14.706981 14.54261 16.501953 12.003906 16.501953 C 9.4652032 16.501953 7.5058594 14.70698 7.5058594 12.585938 L 7.5058594 2.75 L 7.5058594 2 L 6.0058594 2 z M 4.9980469 20.003906 L 4.9980469 21.503906 L 5.7480469 21.503906 L 18.251953 21.503906 L 19.001953 21.503906 L 19.001953 20.003906 L 18.251953 20.003906 L 5.7480469 20.003906 L 4.9980469 20.003906 z"/></svg>`,
        video: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>`,
        weather: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z"/></svg>`,
    },
    resolveLegacyServiceRoute: (sId, index = 0) => {
        if (sId !== "com.standard.editor") return {serviceId: sId, portalIndex: index ?? 0};
        const portalIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
        const byPortalIndex = {
            0: "com.standard.editor.text",
            1: "com.standard.editor.text",
            2: "com.standard.editor.sheet",
            3: "com.standard.editor.slides",
            4: "com.standard.editor.code",
            5: "com.standard.editor.code",
            6: "com.standard.editor.video",
        };
        return {serviceId: byPortalIndex[portalIndex] || "com.standard.editor.text", portalIndex: 0};
    },
    findPortalWindow: (serviceId, portalIndex = 0) => {
        const normalizedPortalIndex = Number.isFinite(Number(portalIndex)) ? Number(portalIndex) : 0;
        return [...Array.from(document.querySelectorAll(".draggable-window"))].reverse().find((windowNode) => windowNode?.portal?.serviceId?.() === serviceId && windowNode?.portal?.portalIndex?.() === normalizedPortalIndex) || null;
    },
    ensurePortalFront: (serviceId, portalIndex = 0) => {
        if (typeof modular?.bringToFront !== "function") return;
        const windowNode = modular.findPortalWindow(serviceId, portalIndex);
        if (windowNode) modular.bringToFront(windowNode);
    },
    start: (sId, options = {}) => {
        const route = modular.resolveLegacyServiceRoute(sId, options?.portalIndex ?? 0);
        const targetServiceId = route?.serviceId || sId;
        const targetPortalIndex = Number.isFinite(Number(route?.portalIndex)) ? Number(route.portalIndex) : 0;
        if (window.StandardPlatformInterfaces && !window.StandardPlatformInterfaces.isEnabled(targetServiceId)) {
            console.warn(`${targetServiceId} is disabled`);
            return null;
        }
        if (sId !== null) {
            for (let i = 0; i < modular.running.length; i++) {
                const ls = modular.running[i];
                if (ls.is(targetServiceId)) {
                    const portalInstance = ls.start(targetPortalIndex, {newInstance: false, ...(options || {})});
                    modular.ensurePortalFront(targetServiceId, targetPortalIndex);
                    return portalInstance;
                }
            }
        } else {
            console.error("modular.start() expects argument as Service ID. None provided");
        }
    },
    show: (sId, index, options = {}) => {
        const route = modular.resolveLegacyServiceRoute(sId, index);
        const targetServiceId = route?.serviceId || sId;
        const targetPortalIndex = Number.isFinite(Number(route?.portalIndex)) ? Number(route.portalIndex) : 0;
        if (window.StandardPlatformInterfaces && !window.StandardPlatformInterfaces.isEnabled(targetServiceId)) {
            console.warn(`${targetServiceId} is disabled`);
            return null;
        }
        if (sId !== null) {
            for (let i = 0; i < modular.running.length; i++) {
                const ls = modular.running[i];
                if (ls.is(targetServiceId)) {
                    const portalInstance = ls.start(targetPortalIndex, {newInstance: true, ...(options || {})});
                    modular.ensurePortalFront(targetServiceId, targetPortalIndex);
                    return portalInstance;
                }
            }
        } else {
            console.error("modular.start() expects argument as Service ID. None provided");
        }
    },
    register: (service) => {
        if (!this.windowFocusSetup) {
            this.windowFocusSetup = true;
            document.addEventListener("pointermove", (event) => {
                if (event.pointerType === "mouse") modular.lastPointerPosition = {x: event.clientX, y: event.clientY};
            });
            document.addEventListener("mousedown", (event) => {
                modular.lastClickPosition = {x: event.clientX, y: event.clientY};
                const windowDiv = event.target.closest(".draggable-window");
                if (windowDiv) modular.bringToFront(windowDiv);
            });
            document.addEventListener("touchstart", (event) => {
                const touch = event.touches?.[0];
                if (touch) modular.lastClickPosition = {x: touch.clientX, y: touch.clientY};
            }, {passive: true});
        }
        if (service instanceof Service) {
            if (modular.running === undefined) modular.running = [];
            modular.running.push(service);
            modular.renderInterfaceShortcuts();
            return service;
        }
    },
    preferredPortalCenterPoint: () => {
        const isTouchDisplay = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window);
        const isMobileViewport = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
        if (isTouchDisplay || isMobileViewport) return modular.lastClickPosition;
        return modular.lastPointerPosition || modular.lastClickPosition;
    },
    registerWidget: (widget) => {
        if (widget instanceof Widget) {
            if (!Array.isArray(modular.widgets)) modular.widgets = [];
            modular.widgets.push(widget);
            if (typeof modular.refreshWidgetTools === "function") modular.refreshWidgetTools();
            return widget;
        }
    },
    widgetsForPortal: (serviceId, portalIndex = 0) => {
        const normalizedServiceId = `${serviceId || ""}`.trim();
        if (!normalizedServiceId) return [];
        return (modular.widgets || []).filter(widget => {
            const widgetPortal = widget?.portal?.();
            const portalId = typeof widgetPortal === "object" && widgetPortal !== null ? widgetPortal.serviceId : widgetPortal;
            if (`${portalId || ""}`.trim() !== normalizedServiceId) return false;
            const tiedPortalIndex = typeof widgetPortal === "object" && widgetPortal !== null ? widgetPortal.portalIndex : widget?.portalIndex?.();
            return tiedPortalIndex === null || tiedPortalIndex === undefined || tiedPortalIndex === "" || Number(tiedPortalIndex) === Number(portalIndex || 0);
        });
    },
    refreshWidgetTools: () => {
        document.querySelectorAll(".draggable-window:not(.widget-window)").forEach((windowNode) => {
            windowNode?.portal?.refreshWidgetTools?.();
        });
    },
    renderInterfaceShortcuts: () => {
        const container = document.getElementById("interface-shortcuts");
        if (!container) return;
        const services = (modular.running || []).filter(service => !window.StandardPlatformInterfaces || window.StandardPlatformInterfaces.isEnabled(service?.name?.())).map(service => service?.interfaceShortcut?.()).filter(shortcut => shortcut?.serviceId && shortcut?.icon);
        container.innerHTML = "";
        services.forEach(shortcut => {
            const icon = document.createElement("div");
            icon.className = "interface-icon inline segue";
            icon.title = shortcut.title || shortcut.serviceId;
            icon.setAttribute("service", shortcut.serviceId);
            if (typeof shortcut.action === "function") icon._launchAction = shortcut.action;
            const iconMarkup = shortcut.icon || "";
            if (iconMarkup.trim().startsWith("<svg")) {
                const parsed = new DOMParser().parseFromString(iconMarkup, "image/svg+xml").documentElement;
                parsed.setAttribute("aria-hidden", "true");
                icon.appendChild(parsed);
            } else {
                const img = document.createElement("img");
                img.src = iconMarkup;
                img.alt = shortcut.title || shortcut.serviceId;
                icon.appendChild(img);
            }
            container.appendChild(icon);
        });
        window.StandardDesktop?.refreshShortcutIcons?.();
    },
    refreshPortalIcons: () => {
        document.querySelectorAll(".draggable-window").forEach((windowNode) => {
            windowNode?.portal?.refreshIcon?.();
        });
    },
    refresh: (sId) => {
        if (sId !== null) {
            for (let i = 0; i < modular.running.length; i++) {
                const ls = modular.running[i];
                if (ls.is(sId)) ls.refresh();
            }
        } else {
            console.error("modular.refresh() expects argument as Service ID. None provided");
        }
    },
    hide: (sId) => {
        if (sId !== null) {
            for (let i = 0; i < modular.running.length; i++) {
                const ls = modular.running[i];
                if (ls.is(sId)) ls.hide();
            }
        } else {
            console.error("modular.hide() expects argument as Service ID. None provided");
        }
    },
    showWidget: (wId, index = 0) => {
        if (!wId) return;
        (modular.widgets || []).forEach(widget => {
            if (widget?.is?.(wId) && widget.index() === (index ?? 0)) widget.show();
        });
    },
    hideWidget: (wId) => {
        if (!wId) return;
        (modular.widgets || []).forEach(widget => {
            if (widget?.is?.(wId)) widget.hide();
        });
    },
    exit: (sId) => {
        if (sId !== null) {
            modular.running = (modular.running || []).filter(ls => {
                if (ls.is(sId)) {
                    ls.exit();
                    return false;
                }
                return true;
            });
        } else {
            console.error("modular.exit() expects argument as Service ID. None provided");
        }
    },
    get: (query) => {
        const s = query.split("=");
        if (s.length % 2 === 0) {
        } else {
            console.error("Invalid argument at modular.get(). Expects argument as 'property=value'")
        }
    },
    user: {
        readCookie: (name) => {
            const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
            if (!match) return null;
            try {
                return decodeURIComponent(match[1]);
            } catch (_) {
                return match[1];
            }
        },
        normalizeRecord: (payload) => {
            if (!payload) return null;
            let record = null;
            if (Array.isArray(payload)) record = payload[0] || null;
            else if (Array.isArray(payload.user)) record = payload.user[0] || null;
            else if (payload.user && typeof payload.user === "object") record = payload.user;
            else if (typeof payload === "object" && !Array.isArray(payload)) record = payload;
            if (!record || typeof record !== "object" || Array.isArray(record)) return null;
            const normalized = {...record};
            if ((normalized.settings === undefined || normalized.settings === null || normalized.settings === "") && normalized.theme !== undefined) normalized.settings = normalized.theme;
            if ((normalized.theme === undefined || normalized.theme === null || normalized.theme === "") && normalized.settings !== undefined) normalized.theme = normalized.settings;
            return normalized;
        },
        hasUsableSettings: (userRecord) => {
            return Boolean(modular.user.parseSettings(userRecord?.settings) || modular.user.parseSettings(userRecord?.theme));
        },
        readCachedUserRecord: () => modular.user.normalizeRecord(window.__stdUserRecordCache || null),
        cacheUserRecord: (userRecord) => {
            const normalizedRecord = modular.user.normalizeRecord(userRecord);
            if (!normalizedRecord) return;
            window.__stdUserRecordCache = normalizedRecord;
        },
        parseSettings: (value) => {
            let candidate = value;
            for (let attempt = 0; attempt < 3; attempt += 1) {
                if (!candidate) return null;
                if (typeof candidate === "object" && !Array.isArray(candidate)) return candidate;
                if (typeof candidate !== "string") return null;
                const trimmed = candidate.trim();
                if (!trimmed) return null;
                try {
                    candidate = JSON.parse(trimmed);
                    continue;
                } catch (_) {
                }
                try {
                    candidate = JSON.parse(trimmed.replace(/\\"/g, "\"").replace(/\\\\/g, "\\"));
                    continue;
                } catch (_) {
                }
                if ((trimmed.startsWith("{\\\"") || trimmed.includes("\\\"")) && trimmed.endsWith("}")) {
                    try {
                        candidate = JSON.parse(trimmed.replace(/\\"/g, "\"").replace(/\\\\/g, "\\"));
                        continue;
                    } catch (_) {
                    }
                }
                return null;
            }
            return (candidate && typeof candidate === "object" && !Array.isArray(candidate)) ? candidate : null;
        },
        id: () => {
            const userId = modular.user.readCookie("uid");
            if (userId) return userId;
        },
        fetchThemePayload: async () => {
            const res = await fetch("/api/user/theme", {credentials: "same-origin", cache: "no-store"});
            if (!res.ok) {
                console.error("Failed to fetch /api/user/theme:", res.status);
                return null;
            }
            return await res.json();
        },
        data: async () => {
            const cachedRecord = modular.user.readCachedUserRecord();
            if (cachedRecord && typeof cachedRecord === "object" && modular.user.hasUsableSettings(cachedRecord)) return cachedRecord;
            const themePayload = await modular.user.fetchThemePayload();
            const themedUserRecord = modular.user.normalizeRecord(themePayload?.user || themePayload);
            if (themedUserRecord && typeof themedUserRecord === "object") {
                modular.user.cacheUserRecord(themedUserRecord);
                return themedUserRecord;
            }
            const res = await fetch("/api/user", {credentials: "same-origin", cache: "no-store"});
            if (!res.ok) {
                console.error("Failed to fetch /api/user:", res.status);
                return null;
            }
            const userRecord = modular.user.normalizeRecord(await res.json());
            if (userRecord && typeof userRecord === "object" && modular.user.hasUsableSettings(userRecord)) modular.user.cacheUserRecord(userRecord);
            return userRecord;
        },
        theme: async () => {
            const cachedRecord = modular.user.readCachedUserRecord();
            const cachedSettings = modular.user.parseSettings(cachedRecord?.settings) || modular.user.parseSettings(cachedRecord?.theme);
            if (cachedSettings && typeof cachedSettings === "object") return cachedSettings;
            const themePayload = await modular.user.fetchThemePayload();
            const payloadTheme = modular.user.parseSettings(themePayload?.theme);
            const themedUserRecord = modular.user.normalizeRecord(themePayload?.user || themePayload);
            if (themedUserRecord && typeof themedUserRecord === "object") modular.user.cacheUserRecord(themedUserRecord);
            if (payloadTheme && typeof payloadTheme === "object") return payloadTheme;
            const userRecord = await modular.user.data();
            const parsedSettings = modular.user.parseSettings(userRecord?.settings) || modular.user.parseSettings(userRecord?.theme);
            if (parsedSettings && typeof parsedSettings === "object") {
                modular.user.cacheUserRecord(userRecord);
                return parsedSettings;
            }
            return null;
        }
    },
    putPublicValue(sId, key, value) {
    },
    publicValue(sId, key) {
    },
    setWidgetDockPosition: (position, options = {}) => {
        const allowed = ["top-left", "top-right", "bottom-left", "bottom-right"];
        if (!allowed.includes(position)) return modular.widgetDockPosition;
        modular.widgetDockPosition = position;
        if (!options.skipPersist && typeof windowStateManager?.saveState === "function") windowStateManager.saveState("__widget-config__", 0, {dockPosition: position, type: "widget-config", open: false}, "widget-config");
        modular.dockWidgets();
        return modular.widgetDockPosition;
    },
    dockWidgets: (position) => {
        const allowed = ["top-left", "top-right", "bottom-left", "bottom-right"];
        const chosenPosition = allowed.includes(position) ? position : modular.widgetDockPosition;
        modular.widgetDockPosition = chosenPosition;
        const widgets = (modular.widgets || []).filter(widget => widget?.isOpen?.());
        if (!widgets.length) return;
        const margin = 12;
        const fromRight = chosenPosition.includes("right");
        const fromBottom = chosenPosition.includes("bottom");
        let cursorY = fromBottom ? window.innerHeight - margin : margin;
        widgets.forEach(widget => {
            const {width, height} = widget.getDimensions();
            const left = fromRight ? Math.max(margin, window.innerWidth - width - margin) : margin;
            const top = fromBottom ? Math.max(margin, cursorY - height) : cursorY;
            widget.setPosition(left, top, chosenPosition);
            cursorY = fromBottom ? top - margin : cursorY + height + margin;
        });
    },
    announce: (type, message) => {
        const text = `${message ?? ""}`.trim();
        pushMessage(type, message);
        if (!text || typeof document === "undefined") return;
        if (modular.titleMessageOriginal === null) modular.titleMessageOriginal = document.title;
        document.title = text;
        if (modular.titleMessageRestoreTimer) clearTimeout(modular.titleMessageRestoreTimer);
        modular.titleMessageRestoreTimer = setTimeout(() => {
            if (modular.titleMessageOriginal !== null) document.title = modular.titleMessageOriginal;
            modular.titleMessageOriginal = null;
            modular.titleMessageRestoreTimer = null;
        }, 15000);
    },
    error: m => modular.announce("error", m),
    success: m => modular.announce("success", m),
    message: m => pushMessage("", m),
    invalidFileNameMessage: "File name cannot contain / or –",
    validateFileName: (fileName = "") => {
        if (!/[\/\u2013\u2014]/.test(String(fileName || ""))) return true;
        modular.error(modular.invalidFileNameMessage);
        return false;
    },
    raisePinnedWidgets: (preferredElement = null) => {
        const pinnedWindows = Array.from(document.querySelectorAll('.widget-window.widget-pinned'));
        if (preferredElement?.classList?.contains('widget-pinned')) {
            const preferredIndex = pinnedWindows.indexOf(preferredElement);
            if (preferredIndex >= 0) pinnedWindows.splice(preferredIndex, 1);
            pinnedWindows.push(preferredElement);
        }
        pinnedWindows.forEach((widgetWindow, index) => {
            widgetWindow.style.zIndex = `${2147483000 + index}`;
        });
    },
    focusLastWindow: (excludedElement = null) => {
        const focusedWindow = document.querySelector('.draggable-window.window-focused:not(.widget-window):not(.minimized)');
        if (focusedWindow && focusedWindow !== excludedElement) return focusedWindow;
        const nextWindow = Array.from(document.querySelectorAll('.draggable-window:not(.widget-window):not(.minimized)'))
            .filter(windowNode => windowNode !== excludedElement && document.body.contains(windowNode))
            .sort((left, right) => {
                const leftZ = Number.parseInt(window.getComputedStyle(left).zIndex, 10) || 0;
                const rightZ = Number.parseInt(window.getComputedStyle(right).zIndex, 10) || 0;
                return rightZ - leftZ;
            })[0] || null;
        if (nextWindow) {
            modular.bringToFront(nextWindow);
        } else {
            window.StandardElectron?.setFocusedService?.("");
        }
        return nextWindow;
    },
    bringToFront: (element) => {
        if (!element) return;
        document.querySelectorAll('.draggable-window.window-focused').forEach(windowDiv => {
            if (windowDiv !== element) {
                windowDiv.classList.remove('window-focused');
            }
        });
        element.classList.add('window-focused');
        window.StandardElectron?.setFocusedService?.(element?.portal?.serviceId?.() || "");
        modular.highestZ += 1;
        element.style.zIndex = `${modular.highestZ}`;
        modular.raisePinnedWidgets(element);
    }
}
if (typeof window !== "undefined") window.addEventListener("resize", () => modular.dockWidgets());
document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".segue[service]");
    if (!trigger) return;
    if (typeof trigger._launchAction === "function") {
        trigger._launchAction();
        return;
    }
    modular.show(trigger.getAttribute("service"), 0);
});
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => modular.renderInterfaceShortcuts());
} else {
    modular.renderInterfaceShortcuts();
}
