

# Fix: Calendar date picker closing too quickly

## Root cause

The `Popover` at line 270 uses `onOpenChange={(open) => !open && setEditingDateIdx(null)}`. When the DropdownMenu item "Editar Data" is clicked, the dropdown closes and triggers focus/pointer events that cause the Popover to immediately fire `onOpenChange(false)`, closing the calendar before the user can interact.

## Fix

In `src/components/client-detail/AgreementInstallments.tsx` (line 270):

1. Add `modal={true}` to `PopoverContent` — this prevents the popover from closing on outside pointer events and keeps focus trapped inside
2. Remove the `onOpenChange` handler from the Popover — instead, only close via:
   - Successful date selection (already handled in `handleEditDate` which calls `setEditingDateIdx(null)`)
   - An explicit cancel/close button inside the popover

Concrete change:

```tsx
// FROM:
<Popover open onOpenChange={(open) => !open && setEditingDateIdx(null)}>
  <PopoverTrigger asChild>...</PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <Calendar ... />
  </PopoverContent>
</Popover>

// TO:
<Popover open>
  <PopoverTrigger asChild>...</PopoverTrigger>
  <PopoverContent 
    className="w-auto p-0" 
    align="start"
    onOpenAutoFocus={(e) => e.preventDefault()}
    onInteractOutside={(e) => {
      e.preventDefault();
      setEditingDateIdx(null);
    }}
  >
    <Calendar ... />
  </PopoverContent>
</Popover>
```

This separates "interact outside to dismiss" (which fires after the popover is stable) from the initial focus-shift event that was causing the premature close.

## Files affected

| File | Change |
|---|---|
| `src/components/client-detail/AgreementInstallments.tsx` | Fix Popover dismiss behavior for date editing |

No other files, no database changes, no impact on other flows.

