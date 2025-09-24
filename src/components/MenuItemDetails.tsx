'use client';

import { useState, useEffect } from 'react';
import { MenuItem, MenuModifierGroup, MenuOption } from '@/actions/menu';
import { CartItem } from './MenuView';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Minus, Plus } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type MenuItemDetailsProps = {
  item: MenuItem;
  onAddToCart: (cartItem: CartItem) => void;
};

export function MenuItemDetails({ item, onAddToCart }: MenuItemDetailsProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<{ [groupId: string]: string[] }>({});
  const [quantity, setQuantity] = useState(1);

  // Initialize default selections
  useEffect(() => {
    const initialSelections: { [groupId: string]: string[] } = {};

    item.modifierGroups.forEach(group => {
      const defaultOptions = group.options.filter(option => option.isDefault);
      if (defaultOptions.length > 0) {
        initialSelections[group.id] = defaultOptions.map(option => option.id);
      } else if (group.isRequired && !group.isMultiSelect) {
        // For required single-select groups, select the first option if no defaults
        initialSelections[group.id] = [group.options[0]?.id].filter(Boolean);
      } else {
        initialSelections[group.id] = [];
      }
    });

    setSelectedModifiers(initialSelections);
  }, [item]);

  const handleModifierChange = (groupId: string, optionId: string, isSelected: boolean) => {
    setSelectedModifiers(prev => {
      const group = item.modifierGroups.find(g => g.id === groupId);
      if (!group) return prev;

      const currentSelections = prev[groupId] || [];

      if (group.isMultiSelect) {
        if (isSelected) {
          // Add if not at max selections
          if (currentSelections.length < group.maxSelections) {
            return { ...prev, [groupId]: [...currentSelections, optionId] };
          }
        } else {
          // Remove selection
          return { ...prev, [groupId]: currentSelections.filter(id => id !== optionId) };
        }
      } else {
        // Single select - replace current selection
        if (isSelected) {
          return { ...prev, [groupId]: [optionId] };
        } else {
          return { ...prev, [groupId]: [] };
        }
      }

      return prev;
    });
  };

  const calculateTotalPrice = () => {
    let total = item.price;

    Object.entries(selectedModifiers).forEach(([groupId, optionIds]) => {
      const group = item.modifierGroups.find(g => g.id === groupId);
      if (group) {
        optionIds.forEach(optionId => {
          const option = group.options.find(o => o.id === optionId);
          if (option) {
            total += option.price;
          }
        });
      }
    });

    return total * quantity;
  };

  const isValidSelection = () => {
    return item.modifierGroups.every(group => {
      const selections = selectedModifiers[group.id] || [];
      return selections.length >= group.minSelections && selections.length <= group.maxSelections;
    });
  };

  const handleAddToCart = () => {
    if (!isValidSelection()) return;

    const cartItem: CartItem = {
      id: '', // Will be set in MenuView
      menuItem: item,
      selectedModifiers,
      quantity,
      totalPrice: calculateTotalPrice()
    };

    onAddToCart(cartItem);
  };

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-60px)]">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Item image and basic info */}
        {item.imageUrl && (
          <div className="px-4">
            <div className="relative h-64 w-full overflow-hidden">
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                className="object-cover"
              />
            </div>
          </div>
        )}

        <div className="pb-4 mx-4 mb-2 border-b border-gray-200">
          <p className="text-gray-700">{item.description}</p>

          {item.allergens.length > 0 && (
            <div>
              <span className="text-sm font-medium mr-2">Allergens:</span>
              <span className="text-sm">
                {item.allergens.join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* Modifier groups */}
        {item.modifierGroups.map((group) => (
          <ModifierGroupSection
            key={group.id}
            group={group}
            selectedOptions={selectedModifiers[group.id] || []}
            onModifierChange={handleModifierChange}
            isLastItem={group === item.modifierGroups[item.modifierGroups.length - 1]}
          />
        ))}
      </div>

      {/* Sticky bottom section */}
      <div className="sticky bottom-0 z-50 p-4 flex gap-2">
        {/* Quantity controls */}
        <div className="flex">
          <div className="flex items-center bg-[#AFD0DE] rounded-full p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="h-10 w-10 rounded-full hover:bg-transparent hover:text-gray-600"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-center text-xl">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuantity(quantity + 1)}
              className="h-10 w-10 rounded-full hover:bg-transparent hover:text-gray-600"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Add to cart button */}
        <Button
          className="flex-1 py-8 rounded-full bg-black text-white hover:bg-gray-800 text-base font-medium"
          onClick={handleAddToCart}
          disabled={!isValidSelection()}
        >
          Add to cart &nbsp;&nbsp;&nbsp; ${calculateTotalPrice().toFixed(2)}
        </Button>
      </div>
    </div>
  );
}

type ModifierGroupSectionProps = {
  group: MenuModifierGroup;
  selectedOptions: string[];
  onModifierChange: (groupId: string, optionId: string, isSelected: boolean) => void;
  isLastItem: boolean;
};

function ModifierGroupSection({
  group,
  selectedOptions,
  onModifierChange,
  isLastItem
}: ModifierGroupSectionProps) {
  const getSelectionText = () => {
    if (group.isRequired) {
      if (group.isMultiSelect) {
        return `Required - Choose ${group.minSelections} to ${group.maxSelections}`;
      } else {
        return 'Required - Choose 1';
      }
    } else {
      if (group.isMultiSelect) {
        return `Optional - Choose up to ${group.maxSelections}`;
      } else {
        return 'Optional';
      }
    }
  };


  return (
    <div className={cn("pb-4 mx-4 mb-4", !isLastItem && "border-b border-gray-200")}>
      <div className="flex items-center gap-2 pb-2">
        <h3 className="font-semibold text-lg">{group.name}</h3>
        <p className="text-xs text-gray-500 mt-1">{getSelectionText()}</p>
      </div>

      {group.isMultiSelect ? (
        <div className="space-y-2 gap-0">
          {group.options.map((option) => (
            <ModifierCheckboxOption
              key={option.id}
              option={option}
              isSelected={selectedOptions.includes(option.id)}
              onChange={(isSelected) =>
                onModifierChange(group.id, option.id, isSelected)
              }
              disabled={
                !selectedOptions.includes(option.id) &&
                selectedOptions.length >= group.maxSelections
              }
            />
          ))}
        </div>
      ) : (
        <RadioGroup
          value={selectedOptions[0] || ''}
          onValueChange={(value) => {
            // Clear current selection first
            selectedOptions.forEach(id =>
              onModifierChange(group.id, id, false)
            );
            // Set new selection
            onModifierChange(group.id, value, true);
          }}
          className="space-y-2 gap-0"
        >
          {group.options.map((option) => (
            <ModifierRadioOption
              key={option.id}
              option={option}
              value={option.id}
            />
          ))}
        </RadioGroup>
      )}
    </div>
  );
}

type ModifierCheckboxOptionProps = {
  option: MenuOption;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
  disabled?: boolean;
};

function ModifierCheckboxOption({
  option,
  isSelected,
  onChange,
  disabled
}: ModifierCheckboxOptionProps) {
  return (
    <div className="flex items-center space-x-1">
      <Checkbox
        id={option.id}
        checked={isSelected}
        onCheckedChange={onChange}
        disabled={disabled}
        className="size-5"
      />
      <Label
        htmlFor={option.id}
        className="flex-1 cursor-pointer justify-between items-end"
      >
        <div className="flex justify-between items-end">
          <div className="flex gap-2 items-end">
            <div className="font-medium text-base">{option.name}</div>
            <div className="text-sm text-gray-600">{option.description}</div>
          </div>

        </div>

        <div>
          {option.price > 0 && (
            <div className="font-medium">
              (+${option.price.toFixed(2)})
            </div>
          )}
        </div>
      </Label>
    </div>
  );
}

type ModifierRadioOptionProps = {
  option: MenuOption;
  value: string;
};

function ModifierRadioOption({ option, value }: ModifierRadioOptionProps) {
  return (
    <div className="flex items-center space-x-1">
      <RadioGroupItem value={value} id={option.id} className="size-5" />
      <Label
        htmlFor={option.id}
        className="flex-1 cursor-pointer justify-between items-end"
      >
        <div className="flex gap-2 items-end">
          <div className="font-medium text-base">{option.name}</div>
          <div className="text-xs text-gray-600 mb-0.5">{option.description}</div>
        </div>
        <div>
          {1.00 > 0 && (
            <div className="font-medium">
              (+${(1.00).toFixed(2)})
            </div>
          )}
        </div>
      </Label>
    </div>
  );
}

