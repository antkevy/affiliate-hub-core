import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface MultiSelectProps {
  id: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = new Map(
    options
      .filter((option) => value.includes(option.value))
      .map((option) => [option.value, option]),
  );

  function toggle(itemValue: string) {
    onChange(
      value.includes(itemValue)
        ? value.filter((item) => item !== itemValue)
        : [...value, itemValue],
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-9 w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              {value.length === 0
                ? placeholder
                : `${value.length} selecionado${value.length > 1 ? "s" : ""}`}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full min-w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder ?? placeholder} />
            <CommandList>
              <CommandEmpty>{emptyText ?? "Nenhum resultado."}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = value.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => toggle(option.value)}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="flex-1">
                        <span className="block text-sm">{option.label}</span>
                        {option.hint ? (
                          <span className="block text-xs text-muted-foreground">{option.hint}</span>
                        ) : null}
                      </span>
                      {checked ? <Check className="size-4 text-primary" /> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.size > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((itemValue) => {
            const option = selected.get(itemValue);
            if (!option) return null;
            return (
              <Badge key={itemValue} variant="secondary" className="gap-1 pr-1 font-normal">
                {option.label}
                <button
                  type="button"
                  aria-label={`Remover ${option.label}`}
                  onClick={() => toggle(itemValue)}
                  className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
