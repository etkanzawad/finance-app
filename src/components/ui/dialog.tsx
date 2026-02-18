"use client"

import * as React from "react"
import { XIcon, Calculator, Delete } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

// --- Inline Calculator ---

function InlineCalculator() {
  const [display, setDisplay] = React.useState("0")
  const [previousValue, setPreviousValue] = React.useState<number | null>(null)
  const [operator, setOperator] = React.useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = React.useState(false)
  const [history, setHistory] = React.useState("")

  function calculate(a: number, b: number, op: string): number {
    switch (op) {
      case "+": return a + b
      case "-": return a - b
      case "*": return a * b
      case "/": return b !== 0 ? a / b : 0
      default: return b
    }
  }

  function fmt(n: number): string {
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString()
    const s = parseFloat(n.toFixed(10)).toString()
    return s.length > 14 ? n.toExponential(4) : s
  }

  function inputDigit(digit: string) {
    if (waitingForOperand) {
      setDisplay(digit)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === "0" ? digit : display + digit)
    }
  }

  function inputDot() {
    if (waitingForOperand) { setDisplay("0."); setWaitingForOperand(false); return }
    if (!display.includes(".")) setDisplay(display + ".")
  }

  function doOperator(nextOp: string) {
    const current = parseFloat(display)
    const sym = nextOp === "*" ? "×" : nextOp === "/" ? "÷" : nextOp
    if (previousValue !== null && operator && !waitingForOperand) {
      const result = calculate(previousValue, current, operator)
      setDisplay(fmt(result)); setPreviousValue(result); setHistory(`${fmt(result)} ${sym}`)
    } else {
      setPreviousValue(current); setHistory(`${display} ${sym}`)
    }
    setOperator(nextOp); setWaitingForOperand(true)
  }

  function doEquals() {
    if (previousValue === null || operator === null) return
    const current = parseFloat(display)
    const result = calculate(previousValue, current, operator)
    const sym = operator === "*" ? "×" : operator === "/" ? "÷" : operator
    setHistory(`${fmt(previousValue)} ${sym} ${display} =`)
    setDisplay(fmt(result)); setPreviousValue(null); setOperator(null); setWaitingForOperand(true)
  }

  function doClear() {
    setDisplay("0"); setPreviousValue(null); setOperator(null); setWaitingForOperand(false); setHistory("")
  }

  function doBackspace() {
    if (waitingForOperand) return
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0")
  }

  function doPercent() { setDisplay(fmt(parseFloat(display) / 100)) }
  function doNegate() { const c = parseFloat(display); if (c !== 0) setDisplay(fmt(-c)) }

  const btns: { label: string; action: () => void; style: string; wide?: boolean }[] = [
    { label: "C", action: doClear, style: "fn" },
    { label: "±", action: doNegate, style: "fn" },
    { label: "%", action: doPercent, style: "fn" },
    { label: "÷", action: () => doOperator("/"), style: "op" },
    { label: "7", action: () => inputDigit("7"), style: "num" },
    { label: "8", action: () => inputDigit("8"), style: "num" },
    { label: "9", action: () => inputDigit("9"), style: "num" },
    { label: "×", action: () => doOperator("*"), style: "op" },
    { label: "4", action: () => inputDigit("4"), style: "num" },
    { label: "5", action: () => inputDigit("5"), style: "num" },
    { label: "6", action: () => inputDigit("6"), style: "num" },
    { label: "−", action: () => doOperator("-"), style: "op" },
    { label: "1", action: () => inputDigit("1"), style: "num" },
    { label: "2", action: () => inputDigit("2"), style: "num" },
    { label: "3", action: () => inputDigit("3"), style: "num" },
    { label: "+", action: () => doOperator("+"), style: "op" },
    { label: "0", action: () => inputDigit("0"), style: "num", wide: true },
    { label: ".", action: inputDot, style: "num" },
    { label: "=", action: doEquals, style: "eq" },
  ]

  return (
    <div className="flex flex-col">
      {/* Display */}
      <div className="px-3 pt-3 pb-1">
        <div className="text-[10px] text-muted-foreground h-3 text-right font-mono truncate">{history}</div>
        <div className="text-right text-xl font-semibold tracking-tight font-mono truncate">{display}</div>
      </div>
      <div className="px-3 flex justify-end">
        <button onClick={doBackspace} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
          <Delete className="h-3 w-3" />
        </button>
      </div>
      {/* Buttons */}
      <div className="grid grid-cols-4 gap-1 p-2">
        {btns.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            className={cn(
              "h-9 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95",
              btn.wide && "col-span-2",
              btn.style === "num" && "bg-secondary/50 hover:bg-secondary text-foreground",
              btn.style === "fn" && "bg-muted hover:bg-muted/80 text-muted-foreground",
              btn.style === "op" && "bg-primary/20 hover:bg-primary/30 text-primary font-semibold",
              btn.style === "eq" && "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Dialog Content with optional inline calculator ---

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const [showCalc, setShowCalc] = React.useState(false)

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 w-full translate-x-[-50%] translate-y-[-50%] rounded-lg border shadow-lg duration-200 outline-none",
          showCalc ? "max-w-[calc(100%-2rem)] sm:max-w-2xl" : "max-w-[calc(100%-2rem)] sm:max-w-lg",
          className
        )}
        {...props}
      >
        <div className={cn("flex", showCalc ? "flex-col sm:flex-row" : "")}>
          {/* Main form content */}
          <div className={cn("flex-1 p-6 grid gap-4", showCalc && "sm:border-r border-border")}>
            {children}
          </div>

          {/* Calculator panel */}
          {showCalc && (
            <div className="w-full sm:w-56 shrink-0 border-t sm:border-t-0 border-border bg-muted/30 rounded-b-lg sm:rounded-b-none sm:rounded-r-lg">
              <div className="px-3 pt-2 pb-0 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Calculator</span>
              </div>
              <InlineCalculator />
            </div>
          )}
        </div>

        {/* Calculator toggle button */}
        <button
          onClick={() => setShowCalc(!showCalc)}
          className={cn(
            "absolute top-4 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100",
            showCloseButton ? "right-10" : "right-4",
            showCalc && "text-primary opacity-100"
          )}
        >
          <Calculator className="h-4 w-4" />
          <span className="sr-only">Toggle calculator</span>
        </button>

        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
