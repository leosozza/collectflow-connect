import { useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const SimpleCalculator = () => {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay("0,");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(",")) setDisplay(display + ",");
  };

  const clear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const toggleSign = () => {
    const val = parseFloat(display.replace(",", "."));
    if (val !== 0) setDisplay(String(-val).replace(".", ","));
  };

  const percentage = () => {
    const val = parseFloat(display.replace(",", "."));
    setDisplay(String(val / 100).replace(".", ","));
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleOperation = (nextOp: string) => {
    const current = parseFloat(display.replace(",", "."));
    if (previousValue !== null && operation && !waitingForOperand) {
      const result = calculate(previousValue, current, operation);
      setDisplay(String(parseFloat(result.toFixed(10))).replace(".", ","));
      setPreviousValue(result);
    } else {
      setPreviousValue(current);
    }
    setOperation(nextOp);
    setWaitingForOperand(true);
  };

  const equals = () => {
    if (previousValue === null || !operation) return;
    const current = parseFloat(display.replace(",", "."));
    const result = calculate(previousValue, current, operation);
    setDisplay(String(parseFloat(result.toFixed(10))).replace(".", ","));
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  };

  const btnBase = "rounded-full h-12 w-12 text-base font-medium transition-colors focus:outline-none";
  const btnDigit = `${btnBase} bg-muted hover:bg-muted/70 text-foreground`;
  const btnOp = `${btnBase} bg-orange-500 hover:bg-orange-400 text-white`;
  const btnFunc = `${btnBase} bg-secondary hover:bg-secondary/70 text-secondary-foreground`;
  const btnZero = `${btnBase} bg-muted hover:bg-muted/70 text-foreground w-[6.5rem] rounded-full`;

  const OpBtn = ({ label }: { label: string }) => (
    <button
      className={`${btnOp} ${operation === label && waitingForOperand ? "ring-2 ring-white/50" : ""}`}
      onClick={() => handleOperation(label)}
    >
      {label}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Calculadora">
          <Calculator className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 bg-background/95 backdrop-blur-sm border shadow-xl"
        align="end"
        sideOffset={8}
      >
        {/* Display */}
        <div className="bg-muted/50 rounded-lg px-3 py-2 mb-3 text-right">
          <span className="text-2xl font-light text-foreground truncate block">
            {display}
          </span>
        </div>

        {/* Buttons grid */}
        <div className="grid grid-cols-4 gap-2">
          <button className={btnFunc} onClick={clear}>AC</button>
          <button className={btnFunc} onClick={toggleSign}>+/−</button>
          <button className={btnFunc} onClick={percentage}>%</button>
          <OpBtn label="÷" />

          <button className={btnDigit} onClick={() => inputDigit("7")}>7</button>
          <button className={btnDigit} onClick={() => inputDigit("8")}>8</button>
          <button className={btnDigit} onClick={() => inputDigit("9")}>9</button>
          <OpBtn label="×" />

          <button className={btnDigit} onClick={() => inputDigit("4")}>4</button>
          <button className={btnDigit} onClick={() => inputDigit("5")}>5</button>
          <button className={btnDigit} onClick={() => inputDigit("6")}>6</button>
          <OpBtn label="−" />

          <button className={btnDigit} onClick={() => inputDigit("1")}>1</button>
          <button className={btnDigit} onClick={() => inputDigit("2")}>2</button>
          <button className={btnDigit} onClick={() => inputDigit("3")}>3</button>
          <OpBtn label="+" />

          <button className={btnZero} onClick={() => inputDigit("0")}>0</button>
          <button className={btnDigit} onClick={inputDot}>,</button>
          <button className={btnOp} onClick={equals}>=</button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SimpleCalculator;
