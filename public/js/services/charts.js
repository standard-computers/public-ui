(() => {
    const SERVICE_ID = "com.standard.charts";
    const ICON = "/icons/interfaces/whiteboard.png";
    const NS = "http://www.w3.org/2000/svg";
    const shapeKinds = ["rectangle", "rounded", "ellipse", "diamond"];
    const defaultStyle = () => ({fontFamily: "Inter", fontSize: 16, bold: false, italic: false, underline: false, textColor: "#172033", fill: "#ffffff", stroke: "#657089", align: "center"});
    let documentState = freshState();
    let activePath = "";
    let activeController = null;
    let refreshList = null;

    function freshState() {
        return {format: "std.charts.v1", name: "", background: "#f5f6f8", connectorStyle: "straight", viewport: {x: 0, y: 0, scale: 1}, items: [], connectors: []};
    }
    const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const cleanName = value => String(value || "").trim().replace(/\.chrts$/i, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    const normalizePath = value => String(value || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const esc = value => String(value ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const svg = (tag, attrs = {}) => { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); return node; };
    const getWindow = () => Array.from(document.querySelectorAll(".draggable-window")).filter(node => node.querySelector(".window-header .title")?.textContent.trim() === "Charts").pop() || null;
    const editorRoot = () => getWindow()?.querySelector(".charts-editor");

    async function saveChart() {
        const perform = async name => {
            documentState.name = cleanName(name);
            const fileName = `${documentState.name}.chrts`;
            const file = new File([JSON.stringify(documentState)], fileName, {type: "application/json"});
            const url = "/api/upload?directory=Charts";
            let ok = false;
            if (window.StandardUploads?.uploadFile) ok = !!(await window.StandardUploads.uploadFile(file, url, {label: `Saving ${fileName}`}))?.ok;
            else { const body = new FormData(); body.append("file", file); ok = (await fetch(url, {method: "POST", body})).ok; }
            if (!ok) throw new Error("Unable to save chart");
            activePath = `Charts/${fileName}`;
            await window.StandardFilesRefreshCache?.();
            refreshList?.();
            modular.success(`Saved ${fileName}`);
        };
        if (documentState.name) return perform(documentState.name).catch(error => modular.error(error.message));
        inputDialogue({title: "Save chart", placeholder: "Chart name", confirmation: (_, value) => cleanName(value) ? perform(value).catch(error => modular.error(error.message)) : modular.error("Chart name is required")});
    }

    async function openChart(path, payload) {
        documentState = {...freshState(), ...(payload || {}), viewport: {...freshState().viewport, ...(payload?.viewport || {})}, items: Array.isArray(payload?.items) ? payload.items : [], connectors: Array.isArray(payload?.connectors) ? payload.connectors : []};
        activePath = normalizePath(path);
        if (!getWindow()) modular.start(SERVICE_ID);
        await new Promise(resolve => setTimeout(resolve, 80));
        const editRoute = Array.from(getWindow()?.querySelectorAll(".sidebar-item") || []).find(node => /edit/i.test(node.textContent));
        editRoute?.click();
        setTimeout(() => activeController?.load(), 30);
        return true;
    }
    async function openPath(path) {
        try {
            const normalized = normalizePath(path);
            const response = await fetch(`/api/files/download?path=${encodeURIComponent(normalized)}`);
            if (!response.ok) throw new Error();
            return openChart(normalized, JSON.parse(await response.text()));
        } catch (_) { modular.error("Unable to open chart"); return false; }
    }
    window.StandardCharts = {openChartData: openChart, openChartPath: openPath};

    function exportMermaid() {
        const ids = new Map(documentState.items.map((item, index) => [item.id, `N${index + 1}`]));
        const quote = text => String(text || " ").replace(/"/g, "&quot;");
        const nodes = documentState.items.filter(item => item.type !== "image").map(item => {
            const id = ids.get(item.id), label = quote(item.text);
            if (item.kind === "ellipse") return `    ${id}(["${label}"])`;
            if (item.kind === "diamond") return `    ${id}{"${label}"}`;
            if (item.kind === "rounded") return `    ${id}("${label}")`;
            return `    ${id}["${label}"]`;
        });
        const links = documentState.connectors.filter(c => ids.has(c.from.itemId) && ids.has(c.to.itemId)).map(c => `    ${ids.get(c.from.itemId)} -->${c.text ? `|${quote(c.text)}|` : ""} ${ids.get(c.to.itemId)}`);
        const code = ["flowchart TD", ...nodes, ...links].join("\n");
        navigator.clipboard?.writeText(code).catch(() => {});
        inputDialogue({title: "Mermaid chart code (copied)", value: code, confirmation: () => {}});
    }

    function showSearch(anchor) {
        searchDialogue({title: "Search chart", anchor, placeholder: "Text in shapes and connectors", matches: query => {
            const q = query.trim().toLowerCase(); if (!q) return [];
            return [...documentState.items.map(item => ({item, label: item.text || "Untitled shape", detail: item.type === "text" ? "Text box" : "Shape"})), ...documentState.connectors.map(connector => ({connector, label: connector.text || "Connector", detail: "Connector"}))].filter(match => match.label.toLowerCase().includes(q));
        }, preview: (_, match) => activeController?.focusMatch(match), confirmation: (_, match) => activeController?.focusMatch(match)});
    }

    function editorMarkup() {
        return `<div class="charts-editor large-padding-top">
          <div class="charts-toolbar bordered shadowed radius small-padding blurred faded">
            <select data-style="fontFamily" title="Font"><option>Inter</option><option>Arial</option><option>Georgia</option><option>Courier New</option></select>
            <input data-style="fontSize" type="number" min="8" max="96" value="16" title="Font size">
            <button class="naked" data-toggle="bold" title="Bold"><b>B</b></button><button class="naked" data-toggle="italic" title="Italic"><i>I</i></button><button class="naked" data-toggle="underline" title="Underline"><u>U</u></button>
            <input data-style="textColor" type="color" value="#172033" title="Text color"><input data-style="fill" type="color" value="#ffffff" title="Shape fill"><input data-style="stroke" type="color" value="#657089" title="Border color">
            <select data-style="align" title="Text alignment"><option value="left">Left</option><option value="center" selected>Center</option><option value="right">Right</option></select>
            <span class="charts-toolbar-separator"></span>
            <select data-action="shape" title="Insert dialogue shape"><option value="">Shape…</option><option value="rectangle">Rectangle</option><option value="rounded">Rounded rectangle</option><option value="ellipse">Ellipse</option><option value="diamond">Diamond</option></select>
            <button class="naked" data-action="text">Text box</button><button class="naked" data-action="image">Image</button>
            <select data-action="connector-style" title="Chart connector style"><option value="straight">Straight</option><option value="vertexed">Vertexed</option><option value="curved">Curved</option></select>
            <label class="charts-bg-label" title="Chart background">Canvas <input data-action="background" type="color" value="#f5f6f8"></label>
          </div>
          <div class="charts-stage bordered radius shadowed" tabindex="0"><div class="charts-world"><svg class="charts-connectors"><defs><marker id="charts-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="context-stroke"/></marker></defs><g class="charts-lines"></g></svg><div class="charts-items"></div></div><div class="charts-hint">Wheel to zoom · drag empty space to pan · double-click shapes or lines to edit text</div></div>
          <input class="charts-image-input" type="file" accept="image/*" hidden>
        </div>`;
    }

    function setupEditor(root) {
        if (!root || root.__chartsReady) { activeController?.load(); return; }
        root.__chartsReady = true;
        const stage = root.querySelector(".charts-stage"), world = root.querySelector(".charts-world"), itemsLayer = root.querySelector(".charts-items"), linesLayer = root.querySelector(".charts-lines"), imageInput = root.querySelector(".charts-image-input");
        let selected = new Set(), editing = null, drag = null, pan = null, resize = null, connectorDraft = null, clipboard = [];
        const currentStyle = defaultStyle();
        const itemById = id => documentState.items.find(item => item.id === id);
        const vertexPoint = (item, vertex) => ({top: {x: item.x + item.w / 2, y: item.y}, right: {x: item.x + item.w, y: item.y + item.h / 2}, bottom: {x: item.x + item.w / 2, y: item.y + item.h}, left: {x: item.x, y: item.y + item.h / 2}}[vertex]);
        const screenToWorld = (clientX, clientY) => { const rect = stage.getBoundingClientRect(), v = documentState.viewport; return {x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale}; };
        const applyViewport = () => { const v = documentState.viewport; world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.scale})`; };
        const pathFor = connector => {
            const a = itemById(connector.from.itemId), b = itemById(connector.to.itemId); if (!a || !b) return "";
            const p1 = vertexPoint(a, connector.from.vertex), p2 = vertexPoint(b, connector.to.vertex);
            if (documentState.connectorStyle === "curved") { const dx = Math.max(70, Math.abs(p2.x - p1.x) * .5); return `M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}`; }
            if (documentState.connectorStyle === "vertexed") { const mx = (p1.x + p2.x) / 2; return `M${p1.x},${p1.y} L${mx},${p1.y} L${mx},${p2.y} L${p2.x},${p2.y}`; }
            return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
        };
        const renderLines = () => {
            linesLayer.innerHTML = "";
            documentState.connectors.forEach(connector => {
                const group = svg("g", {class: `charts-connector${selected.has(connector.id) ? " selected" : ""}`, "data-id": connector.id});
                const hit = svg("path", {d: pathFor(connector), class: "charts-connector-hit"});
                const line = svg("path", {d: pathFor(connector), class: "charts-connector-line", "marker-end": "url(#charts-arrow)"});
                group.append(hit, line);
                if (connector.text) { const a = itemById(connector.from.itemId), b = itemById(connector.to.itemId); if (a && b) { const p1 = vertexPoint(a, connector.from.vertex), p2 = vertexPoint(b, connector.to.vertex); const label = svg("text", {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2-7, class: "charts-connector-label", "text-anchor": "middle"}); label.textContent = connector.text; group.append(label); } }
                group.addEventListener("click", event => { event.stopPropagation(); selected = new Set([connector.id]); render(); });
                group.addEventListener("dblclick", event => { event.stopPropagation(); inputDialogue({title: "Connector label", value: connector.text || "", confirmation: (_, value) => { connector.text = value; render(); }}); });
                linesLayer.append(group);
            });
        };
        const shapeSvg = item => {
            const shape = svg("svg", {viewBox: `0 0 ${item.w} ${item.h}`, preserveAspectRatio: "none"});
            let node;
            if (item.kind === "ellipse") node = svg("ellipse", {cx: item.w/2, cy: item.h/2, rx: item.w/2-2, ry: item.h/2-2});
            else if (item.kind === "diamond") node = svg("polygon", {points: `${item.w/2},2 ${item.w-2},${item.h/2} ${item.w/2},${item.h-2} 2,${item.h/2}`});
            else node = svg("rect", {x:2,y:2,width:item.w-4,height:item.h-4,rx:item.kind === "rounded" ? 18 : 2});
            node.setAttribute("fill", item.style.fill); node.setAttribute("stroke", item.style.stroke); node.setAttribute("stroke-width", "2"); shape.append(node); return shape;
        };
        const renderItems = () => {
            itemsLayer.innerHTML = "";
            documentState.items.forEach(item => {
                const el = document.createElement("div"); el.className = `charts-item charts-${item.type}${selected.has(item.id) ? " selected" : ""}`; el.dataset.id = item.id;
                Object.assign(el.style, {left:`${item.x}px`,top:`${item.y}px`,width:`${item.w}px`,height:`${item.h}px`});
                if (item.type === "shape") el.append(shapeSvg(item));
                if (item.type === "image") { const image = new Image(); image.src = item.src; image.draggable = false; el.append(image); }
                if (item.type !== "image") { const text = document.createElement("div"); text.className = "charts-item-text"; text.textContent = item.text || ""; Object.assign(text.style, {fontFamily:item.style.fontFamily,fontSize:`${item.style.fontSize}px`,fontWeight:item.style.bold?"700":"400",fontStyle:item.style.italic?"italic":"normal",textDecoration:item.style.underline?"underline":"none",color:item.style.textColor,textAlign:item.style.align}); el.append(text); }
                ["top","right","bottom","left"].forEach(vertex => { const dot = document.createElement("button"); dot.className = `charts-vertex charts-vertex-${vertex}`; dot.dataset.vertex = vertex; dot.title = "Connect"; el.append(dot); });
                if (selected.has(item.id)) ["nw","ne","se","sw"].forEach(handle => { const control = document.createElement("span"); control.className = `charts-resize charts-resize-${handle}`; control.dataset.resize = handle; el.append(control); });
                el.addEventListener("pointerdown", event => itemPointerDown(event, item));
                el.addEventListener("dblclick", event => { if (!event.target.closest(".charts-vertex,.charts-resize")) beginTextEdit(item, el); });
                el.addEventListener("contextmenu", event => showItemMenu(event, item));
                itemsLayer.append(el);
            });
        };
        const render = () => { root.querySelector('[data-action="background"]').value = documentState.background; root.querySelector('[data-action="connector-style"]').value = documentState.connectorStyle; stage.style.backgroundColor = documentState.background; applyViewport(); renderLines(); renderItems(); };
        const addItem = (type, kind = "rectangle", extra = {}) => { const center = screenToWorld(stage.getBoundingClientRect().left + stage.clientWidth/2, stage.getBoundingClientRect().top + stage.clientHeight/2); const item = {id:uid("item"),type,kind,x:center.x-80,y:center.y-45,w:type==="text"?220:160,h:type==="text"?55:90,text:type==="text"?"Text":"",style:{...currentStyle},...extra}; documentState.items.push(item); selected = new Set([item.id]); render(); };
        const beginTextEdit = (item, el) => { if (item.type === "image") return; editing?.remove(); const textNode = el.querySelector(".charts-item-text"); const input = document.createElement("textarea"); input.className = "charts-text-editor"; input.value = item.text || ""; textNode.style.display = "none"; el.append(input); editing = input; input.focus(); input.select(); const finish = () => { item.text = input.value; editing = null; render(); }; input.addEventListener("blur", finish, {once:true}); input.addEventListener("keydown", event => { if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey)) { event.preventDefault(); input.blur(); }}); };
        const itemPointerDown = (event, item) => {
            if (event.button !== 0) return; event.stopPropagation();
            const vertex = event.target.closest(".charts-vertex")?.dataset.vertex;
            if (vertex) {
                if (connectorDraft && connectorDraft.from.itemId !== item.id) {
                    documentState.connectors.push({id:uid("conn"),from:connectorDraft.from,to:{itemId:item.id,vertex},text:""});
                    connectorDraft = null; render(); return;
                }
                connectorDraft = {from:{itemId:item.id,vertex}, pointerId:event.pointerId}; event.target.setPointerCapture?.(event.pointerId); event.target.classList.add("connecting"); return;
            }
            const handle = event.target.closest(".charts-resize")?.dataset.resize;
            if (!event.ctrlKey && !event.metaKey && !selected.has(item.id)) selected = new Set([item.id]); else if (event.ctrlKey || event.metaKey) selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
            if (handle) resize = {item,start:screenToWorld(event.clientX,event.clientY),x:item.x,y:item.y,w:item.w,h:item.h,handle};
            else drag = {start:screenToWorld(event.clientX,event.clientY), originals:documentState.items.filter(i=>selected.has(i.id)).map(i=>({item:i,x:i.x,y:i.y}))};
            render(); stage.setPointerCapture?.(event.pointerId);
        };
        const finishConnector = event => { if (!connectorDraft) return; const target = document.elementFromPoint(event.clientX,event.clientY)?.closest?.(".charts-vertex"); const itemEl = target?.closest(".charts-item"); if (target && itemEl && itemEl.dataset.id !== connectorDraft.from.itemId) { documentState.connectors.push({id:uid("conn"),from:connectorDraft.from,to:{itemId:itemEl.dataset.id,vertex:target.dataset.vertex},text:""}); connectorDraft=null; render(); } };
        const applyStyle = () => { documentState.items.filter(item=>selected.has(item.id) && item.type!=="image").forEach(item => Object.assign(item.style,currentStyle)); render(); };
        const showItemMenu = (event, item) => { event.preventDefault(); selected = new Set([item.id]); render(); const old=document.getElementById("charts-context-menu"); old?.remove(); const menu=document.createElement("div"); menu.id="charts-context-menu"; menu.className="custom-context-menu"; const entries=[...[item.type!=="image"?["Edit text",()=>beginTextEdit(item,itemsLayer.querySelector(`[data-id="${item.id}"]`))]:null,item.type==="shape"?["Fill color",()=>root.querySelector('[data-style="fill"]').click()]:null,["Duplicate",()=>{clipboard=[structuredClone(item)];paste();}], ["Bring to front",()=>{documentState.items=documentState.items.filter(i=>i.id!==item.id).concat(item);render();}], ["Delete",()=>removeSelected()]].filter(Boolean)]; entries.forEach(([label,action])=>{const row=document.createElement("div");row.className="context-menu-item";row.textContent=label;row.onclick=()=>{menu.remove();action();};menu.append(row);}); document.body.append(menu); menu.style.left=`${event.clientX}px`;menu.style.top=`${event.clientY}px`; setTimeout(()=>document.addEventListener("pointerdown",()=>menu.remove(),{once:true}),0); };
        const removeSelected = () => { documentState.items=documentState.items.filter(item=>!selected.has(item.id)); documentState.connectors=documentState.connectors.filter(c=>!selected.has(c.id)&&itemById(c.from.itemId)&&itemById(c.to.itemId)); selected.clear();render(); };
        const copy = () => { clipboard=documentState.items.filter(item=>selected.has(item.id)).map(item=>structuredClone(item)); };
        const paste = () => { if(!clipboard.length)return; const idMap=new Map(); const pasted=clipboard.map(item=>{const clone=structuredClone(item);idMap.set(item.id,uid("item"));clone.id=idMap.get(item.id);clone.x+=24;clone.y+=24;return clone;});documentState.items.push(...pasted);selected=new Set(pasted.map(i=>i.id));clipboard=pasted.map(i=>structuredClone(i));render(); };
        stage.addEventListener("pointerdown", event => { if (event.target===stage || event.target===world || event.target===itemsLayer) { if(!event.shiftKey)selected.clear(); pan={x:event.clientX,y:event.clientY,vx:documentState.viewport.x,vy:documentState.viewport.y}; stage.setPointerCapture?.(event.pointerId);render(); }});
        stage.addEventListener("pointermove", event => { if(connectorDraft)return; const p=screenToWorld(event.clientX,event.clientY); if(drag){const dx=p.x-drag.start.x,dy=p.y-drag.start.y;drag.originals.forEach(o=>{o.item.x=o.x+dx;o.item.y=o.y+dy;});render();} else if(resize){const dx=p.x-resize.start.x,dy=p.y-resize.start.y,i=resize.item;if(resize.handle.includes("e"))i.w=Math.max(40,resize.w+dx);if(resize.handle.includes("s"))i.h=Math.max(30,resize.h+dy);if(resize.handle.includes("w")){i.x=resize.x+dx;i.w=Math.max(40,resize.w-dx);}if(resize.handle.includes("n")){i.y=resize.y+dy;i.h=Math.max(30,resize.h-dy);}render();} else if(pan){documentState.viewport.x=pan.vx+event.clientX-pan.x;documentState.viewport.y=pan.vy+event.clientY-pan.y;applyViewport();} });
        stage.addEventListener("pointerup", event => { finishConnector(event);drag=pan=resize=null; });
        stage.addEventListener("wheel", event => { event.preventDefault();const rect=stage.getBoundingClientRect(),v=documentState.viewport,old=v.scale,next=Math.min(3,Math.max(.25,old*Math.exp(-event.deltaY*.001)));const wx=(event.clientX-rect.left-v.x)/old,wy=(event.clientY-rect.top-v.y)/old;v.x=event.clientX-rect.left-wx*next;v.y=event.clientY-rect.top-wy*next;v.scale=next;applyViewport();},{passive:false});
        root.querySelector('[data-action="shape"]').addEventListener("change",event=>{if(event.target.value)addItem("shape",event.target.value);event.target.value="";});
        root.querySelector('[data-action="text"]').onclick=()=>addItem("text"); root.querySelector('[data-action="image"]').onclick=()=>imageInput.click();
        imageInput.onchange=()=>{const file=imageInput.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>addItem("image","image",{src:reader.result,w:240,h:160});reader.readAsDataURL(file);imageInput.value="";};
        root.querySelectorAll("[data-style]").forEach(control=>control.addEventListener("change",()=>{const key=control.dataset.style;currentStyle[key]=key==="fontSize"?Number(control.value):control.value;applyStyle();}));
        root.querySelectorAll("[data-toggle]").forEach(control=>control.onclick=()=>{const key=control.dataset.toggle;currentStyle[key]=!currentStyle[key];control.classList.toggle("active",currentStyle[key]);applyStyle();});
        root.querySelector('[data-action="background"]').oninput=event=>{documentState.background=event.target.value;render();}; root.querySelector('[data-action="connector-style"]').onchange=event=>{documentState.connectorStyle=event.target.value;render();};
        stage.addEventListener("keydown",event=>{if(editing)return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="c"){event.preventDefault();copy();}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="v"){event.preventDefault();paste();}if(event.key==="Delete"||event.key==="Backspace"){event.preventDefault();removeSelected();}});
        activeController={load:render,focusMatch:match=>{const item=match?.item||(match?.connector&&itemById(match.connector.from.itemId));if(!item)return;selected=new Set([match.item?.id||match.connector.id]);const rect=stage.getBoundingClientRect(),v=documentState.viewport;v.x=rect.width/2-(item.x+item.w/2)*v.scale;v.y=rect.height/2-(item.y+item.h/2)*v.scale;render();itemsLayer.querySelector(`[data-id="${item.id}"]`)?.classList.add("charts-search-hit");}};
        render(); stage.focus();
    }

    async function renderChartsList() {
        try { const tree=await CLI.send("tree Charts"); const files=Array.isArray(tree?.children)?tree.children.filter(file=>!file.children&&/\.chrts$/i.test(file.name||"")):[]; if(!files.length)return `<div class="charts-empty faded">No charts</div>`; return files.map(file=>`<div class="chart-file padded radius pointer hover-background hover-shadowed center" directive="${esc(file.path)}"><img class="large-icon contained" src="${ICON}"><div>${esc(file.name)}</div></div>`).join(""); } catch(_){return `<div class="faded small-padding">Charts folder not available yet.</div>`;}
    }
    function bindList(root){refreshList=async()=>{const list=root.querySelector(".charts-list");if(!list)return;list.innerHTML=await renderChartsList();list.querySelectorAll(".chart-file").forEach(file=>file.onclick=()=>openPath(file.getAttribute("directive")));};refreshList();}

    modular.register(new Service(SERVICE_ID,[new Portal({title:"Charts",hints:["charts","flowcharts","diagrams"],dimensions:[1000,720],horizontal_nav:true,centered_nav:true,maximized:true,icon:ICON,svg_icon:`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="2" y="3" width="7" height="5" rx="1"/><rect x="15" y="16" width="7" height="5" rx="1"/><path d="M9 5.5h3v13h3M12 12h3"/></svg>`,tools:[{title:"Save",icon:modular.icons.save,onclick:saveChart},{title:"Search",icon:modular.icons.search,onclick:event=>showSearch(event.currentTarget)},{title:"Export Mermaid",icon:`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg>`,onclick:exportMermaid},{title:"New Chart",icon:`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16M4 12h16"/></svg>`,onclick:()=>{documentState=freshState();activePath="";activeController?.load();}}],routes:[{text:"Edit",icon:`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z"/></svg>`,route:()=>editorMarkup(),afterRender:windowBody=>setupEditor(windowBody.querySelector(".charts-editor"))},{text:"Charts",icon:`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 16v-4m4 4V8m4 8v-6"/></svg>`,route:()=>div({style:"charts-list large-padding-top",content:""}),afterRender:bindList}]} )]));
})();
