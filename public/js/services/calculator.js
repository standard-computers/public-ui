(() => {
    const SERVICE_ID = "com.standard.calculator";
    const CALCULATOR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3.75h10.5a2.25 2.25 0 0 1 2.25 2.25v12a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 7.5h9M8.25 11.25h.008v.008H8.25v-.008Zm3.75 0h.008v.008H12v-.008Zm3.75 0h.008v.008h-.008v-.008ZM8.25 15h.008v.008H8.25V15Zm3.75 0h.008v.008H12V15Zm3.75 0h.008v.008h-.008V15Z" /></svg>`;
    const OPERATOR_LABELS = {"/": "÷", "*": "×", "-": "−", "+": "+"};
    const MAX_INPUT_LENGTH = 15;
    let displayValue = "0";
    let accumulator = null;
    let pendingOperator = null;
    let waitingForOperand = false;
    let lastOperator = null;
    let lastOperand = null;
    let expression = "";
    const getCalculatorWindow = () => modular.findPortalWindow?.(SERVICE_ID, 0) || null;
    const finiteNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const normalizeZero = value => Object.is(value, -0) ? 0 : value;
    const formatNumber = value => {
        const number = normalizeZero(Number(value));
        if (!Number.isFinite(number)) return "Error";
        const absolute = Math.abs(number);
        if (absolute >= 1e15 || (absolute > 0 && absolute < 1e-9)) return number.toExponential(8).replace(/\.?0+e/, "e");
        return Number(number.toPrecision(15)).toString();
    };
    const calculate = (left, operator, right) => {
        if (operator === "+") return left + right;
        if (operator === "-") return left - right;
        if (operator === "*") return left * right;
        if (operator === "/") return right === 0 ? NaN : left / right;
        return right;
    };
    const syncPortalState = (portal = getCalculatorWindow()?.portal) => {
        portal?.setWindowState?.({displayValue, accumulator, pendingOperator, waitingForOperand, lastOperator, lastOperand, expression});
    };
    const restoreState = portal => {
        const state = portal?.windowState?.() || {};
        if (!state || !Object.keys(state).length) return;
        displayValue = typeof state.displayValue === "string" ? state.displayValue : "0";
        accumulator = state.accumulator === null ? null : finiteNumber(state.accumulator);
        pendingOperator = Object.hasOwn(OPERATOR_LABELS, state.pendingOperator) ? state.pendingOperator : null;
        waitingForOperand = state.waitingForOperand === true;
        lastOperator = Object.hasOwn(OPERATOR_LABELS, state.lastOperator) ? state.lastOperator : null;
        lastOperand = state.lastOperand === null ? null : finiteNumber(state.lastOperand);
        expression = typeof state.expression === "string" ? state.expression : "";
    };
    const renderDisplay = (root = getCalculatorWindow()) => {
        const display = root?.querySelector?.("#calculator-display");
        const history = root?.querySelector?.("#calculator-history");
        if (display) display.textContent = displayValue;
        if (history) history.textContent = expression || "\u00a0";
    };
    const commit = () => {
        syncPortalState();
        renderDisplay();
    };
    const clear = () => {
        displayValue = "0";
        accumulator = null;
        pendingOperator = null;
        waitingForOperand = false;
        lastOperator = null;
        lastOperand = null;
        expression = "";
        commit();
    };
    const inputDigit = digit => {
        if (displayValue === "Error" || waitingForOperand) {
            displayValue = digit;
            waitingForOperand = false;
        } else if (displayValue === "0") {
            displayValue = digit;
        } else if (displayValue.replace(/[-.]/g, "").length < MAX_INPUT_LENGTH) {
            displayValue += digit;
        }
        lastOperator = null;
        lastOperand = null;
        commit();
    };
    const inputDecimal = () => {
        if (displayValue === "Error" || waitingForOperand) {
            displayValue = "0.";
            waitingForOperand = false;
        } else if (!displayValue.includes(".")) {
            displayValue += ".";
        }
        lastOperator = null;
        lastOperand = null;
        commit();
    };
    const inputOperator = operator => {
        if (displayValue === "Error") clear();
        const inputValue = finiteNumber(displayValue);
        if (pendingOperator && !waitingForOperand) {
            const result = calculate(accumulator, pendingOperator, inputValue);
            if (!Number.isFinite(result)) {
                displayValue = "Error";
                accumulator = null;
                pendingOperator = null;
                waitingForOperand = true;
                expression = "Cannot divide by zero";
                commit();
                return;
            }
            displayValue = formatNumber(result);
            accumulator = result;
        } else if (accumulator === null || !pendingOperator) {
            accumulator = inputValue;
        }
        pendingOperator = operator;
        waitingForOperand = true;
        lastOperator = null;
        lastOperand = null;
        expression = `${formatNumber(accumulator)} ${OPERATOR_LABELS[operator]}`;
        commit();
    };
    const equals = () => {
        if (displayValue === "Error") return;
        let operator = pendingOperator;
        let right = finiteNumber(displayValue);
        let left = accumulator;
        if (!operator && lastOperator) {
            operator = lastOperator;
            right = lastOperand;
            left = finiteNumber(displayValue);
        }
        if (!operator || left === null) return;
        if (waitingForOperand && pendingOperator) right = left;
        const result = calculate(left, operator, right);
        expression = `${formatNumber(left)} ${OPERATOR_LABELS[operator]} ${formatNumber(right)} =`;
        displayValue = Number.isFinite(result) ? formatNumber(result) : "Error";
        accumulator = Number.isFinite(result) ? result : null;
        pendingOperator = null;
        waitingForOperand = true;
        lastOperator = Number.isFinite(result) ? operator : null;
        lastOperand = Number.isFinite(result) ? right : null;
        if (!Number.isFinite(result)) expression = "Cannot divide by zero";
        commit();
    };
    const toggleSign = () => {
        if (displayValue === "Error" || displayValue === "0") return;
        displayValue = displayValue.startsWith("-") ? displayValue.slice(1) : `-${displayValue}`;
        commit();
    };
    const percent = () => {
        if (displayValue === "Error") return;
        const value = finiteNumber(displayValue);
        displayValue = formatNumber(pendingOperator && accumulator !== null ? accumulator * value / 100 : value / 100);
        waitingForOperand = false;
        commit();
    };
    const backspace = () => {
        if (displayValue === "Error" || waitingForOperand) return;
        displayValue = displayValue.length > 1 ? displayValue.slice(0, -1) : "0";
        if (displayValue === "-") displayValue = "0";
        commit();
    };
    const handleAction = (action, value = "") => {
        if (action === "digit") inputDigit(value);
        else if (action === "decimal") inputDecimal();
        else if (action === "operator") inputOperator(value);
        else if (action === "equals") equals();
        else if (action === "clear") clear();
        else if (action === "sign") toggleSign();
        else if (action === "percent") percent();
        else if (action === "backspace") backspace();
    };
    const handleKeyboard = event => {
        if (!getCalculatorWindow()) return;
        const key = event.key;
        if (/^\d$/.test(key)) handleAction("digit", key);
        else if (key === ".") handleAction("decimal");
        else if (["+", "-", "*", "/"].includes(key)) handleAction("operator", key);
        else if (key === "Enter" || key === "=") handleAction("equals");
        else if (key === "Escape" || key.toLowerCase() === "c") handleAction("clear");
        else if (key === "Backspace") handleAction("backspace");
        else if (key === "%") handleAction("percent");
        else return;
        event.preventDefault();
    };
    const button = ({label, action, value = "", style = "", wide = false}) => `<button type="button" class="fat hover-zoom ${style}" data-calculator-action="${action}" data-calculator-value="${value}" style="min-width:0;padding-left:8px;padding-right:8px;${wide ? "grid-column:span 2" : ""}">${label}</button>`;
    const calculatorButtons = () => [
        button({label: "C", action: "clear"}),
        button({label: "±", action: "sign"}),
        button({label: "%", action: "percent"}),
        button({label: "÷", action: "operator", value: "/", style: "primary"}),
        button({label: "7", action: "digit", value: "7"}),
        button({label: "8", action: "digit", value: "8"}),
        button({label: "9", action: "digit", value: "9"}),
        button({label: "×", action: "operator", value: "*", style: "primary"}),
        button({label: "4", action: "digit", value: "4"}),
        button({label: "5", action: "digit", value: "5"}),
        button({label: "6", action: "digit", value: "6"}),
        button({label: "−", action: "operator", value: "-", style: "primary"}),
        button({label: "1", action: "digit", value: "1"}),
        button({label: "2", action: "digit", value: "2"}),
        button({label: "3", action: "digit", value: "3"}),
        button({label: "+", action: "operator", value: "+", style: "primary"}),
        button({label: "0", action: "digit", value: "0", wide: true}),
        button({label: ".", action: "decimal"}),
        button({label: "=", action: "equals", style: "primary"})
    ].join("");
    const bindCalculator = function () {
        restoreState(this.portal);
        const root = this.portal?.window?.() || getCalculatorWindow();
        const keypad = root?.querySelector?.("#calculator-keypad");
        if (keypad) {
            keypad.onclick = event => {
                const target = event.target?.closest?.("[data-calculator-action]");
                if (!target) return;
                handleAction(target.dataset.calculatorAction, target.dataset.calculatorValue || "");
            };
        }
        root?.setAttribute?.("tabindex", "0");
        if (root) root.onkeydown = handleKeyboard;
        root?.focus?.();
        renderDisplay(root);
    };

    window.StandardCalculator = window.StandardCalculator || {clear, equals, inputDigit, inputOperator};
    modular.register(new Service(SERVICE_ID, [new Portal({
        title: "Calculator",
        hints: ["calculator", "calculate", "math", "arithmetic"],
        internal: true,
        dimensions: [340, 430],
        navigation: false,
        resizable: false,
        svg_icon: CALCULATOR_ICON,
        route: () => `<div class="large-padding-top padding-left padding-right">
            <div class="padded" style="text-align:right;overflow:hidden;background:none">
                <div id="calculator-history" class="faded no-wrap" style="min-height:20px;overflow:hidden;text-overflow:ellipsis">${expression || "\u00a0"}</div>
                <div id="calculator-display" aria-live="polite" style="font-size:40px;font-weight:700;line-height:1.25;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${displayValue}</div>
            </div>
            <div id="calculator-keypad" class="spacer" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px">${calculatorButtons()}</div>
        </div>`,
        afterRender: bindCalculator
    })]));
})();
