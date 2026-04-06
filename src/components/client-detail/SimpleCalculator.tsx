"use client";

import { useState } from "react";
import { Calculator, Delete, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MAX_DISPLAY_LENGTH = 10;

const formatForDisplay = (value: number): string => {
  if (!isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
  if (isNaN(value)) return "Error";

  const stringValue = String(value);
  if (stringValue.length <= MAX_DISPLAY_LENGTH) return stringValue;

  if (stringValue.includes(".")) {
    const [integerPart] = stringValue.split(".");
    const availableDecimals = MAX_DISPLAY_LENGTH - integerPart.length - 1;
    if (availableDecimals > 0) return value.toFixed(availableDecimals);
  }

  let precision = 5;
  while (precision >= 0) {
    const exp = value.toExponential(precision);
    if (exp.length <= MAX_DISPLAY_LENGTH) return exp;
    precision--;
  }
  return value.toExponential(0);
};

const calculate = (a: number, b: number, op: string): number => {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": return b !== 0 ? a / b : Infinity;
    default: return b;
  }
};

const SimpleCalculator = () => {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      const newDisplay = display === "0" ? num : display + num;
      const effectiveLength = newDisplay.replace(".", "").replace("-", "").length;
      if (effectiveLength <= MAX_DISPLAY_LENGTH) setDisplay(newDisplay);
    }
  };

  const inputOperation = (nextOp: string) => {
    const inputValue = parseFloat(display);
    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const result = calculate(previousValue, inputValue, operation);
      setDisplay(formatForDisplay(result));
      setPreviousValue(result);
      setHistory((prev) => [...prev.slice(-4), `${previousValue} ${operation} ${inputValue} = ${formatForDisplay(result)}`]);
    }
    setWaitingForOperand(true);
    setOperation(nextOp);
  };

  const performCalculation = () => {
    const inputValue = parseFloat(display);
    if (previousValue !== null && operation) {
      const result = calculate(previousValue, inputValue, operation);
      setDisplay(formatForDisplay(result));
      setHistory((prev) => [...prev.slice(-4), `${previousValue} ${operation} ${inputValue} = ${formatForDisplay(result)}`]);
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const clear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const backspace = () => {
    if (waitingForOperand) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
  };

  const handleClick = (btn: string) => {
    if (btn === "C") return clear();
    if (btn === "=") return performCalculation();
    if (["÷", "×", "-", "+"].includes(btn)) return inputOperation(btn);
    if (btn === "±") return setDisplay(formatForDisplay(parseFloat(display) * -1));
    if (btn === "%") return setDisplay(formatForDisplay(parseFloat(display) / 100));
    if (btn === ".") {
      if (!display.includes(".")) inputNumber(btn);
      return;
    }
    inputNumber(btn);
  };

  const getBtnClass = (btn: string) => {
    if (["÷", "×", "-", "+", "="].includes(btn)) return "bg-orange-500 hover:bg-orange-600 text-white";
    if (["C", "±", "%"].includes(btn)) return "bg-gray-500 hover:bg-gray-600 text-white";
    return "bg-gray-700 hover:bg-gray-600 text-white";
  };

  const rows = [
    ["C", "±", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Calculadora">
          <Calculator className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0 bg-gray-900 border-gray-700 shadow-2xl"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <span className="text-sm font-medium text-gray-300">Calculadora</span>
          <div className="flex gap-1">
            <button
              onClick={() => setHistory([])}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              title="Limpar histórico"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={backspace}
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              title="Apagar"
            >
              <Delete className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* History */}
        <div className="px-3 py-1.5 min-h-[32px] border-b border-gray-800">
          {history.length > 0 ? (
            <div className="space-y-0.5">
              {history.slice(-2).map((entry, i) => (
                <p key={i} className="text-[11px] text-gray-500 text-right truncate">{entry}</p>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-600 text-right">Histórico aparecerá aqui</p>
          )}
        </div>

        {/* Display */}
        <div className="px-3 py-3 text-right">
          <p className="text-3xl font-light text-white tracking-wide truncate">{display}</p>
          {operation && (
            <p className="text-xs text-gray-500 mt-0.5">
              {previousValue} {operation}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-4 gap-1.5 p-3 pt-0">
          {rows.map((row, ri) =>
            row.map((btn) => (
              <button
                key={`${ri}-${btn}`}
                onClick={() => handleClick(btn)}
                className={`${getBtnClass(btn)} h-10 rounded text-lg font-semibold transition-colors active:scale-95`}
              >
                {btn}
              </button>
            ))
          )}
          {/* Last row: 0 (col-span-2), ., = */}
          <button
            onClick={() => handleClick("0")}
            className={`${getBtnClass("0")} h-10 rounded text-lg font-semibold transition-colors active:scale-95 col-span-2`}
          >
            0
          </button>
          <button
            onClick={() => handleClick(".")}
            className={`${getBtnClass(".")} h-10 rounded text-lg font-semibold transition-colors active:scale-95`}
          >
            .
          </button>
          <button
            onClick={() => handleClick("=")}
            className={`${getBtnClass("=")} h-10 rounded text-lg font-semibold transition-colors active:scale-95`}
          >
            =
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SimpleCalculator;
