import { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface Guest {
  id: number;
  dietary_preferences: string | null;
  allergies: string | null;
  favorite_cuisines: string | null;
  dislikes: string | null;
  notes: string | null;
}

interface GuestEditFormProps {
  guest: Guest;
  onSave: (data: {
    dietary_preferences: string;
    allergies: string;
    favorite_cuisines: string;
    dislikes: string;
    notes: string;
  }) => void;
  onCancel: () => void;
}

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  colorClass?: string;
}

function TagInput({ label, value, onChange, placeholder, colorClass = 'bg-gray-100 text-gray-800' }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !value.includes(newTag)) {
        onChange([...value, newTag]);
      }
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="border rounded-lg p-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((tag, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full ${colorClass}`}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || `Add ${label.toLowerCase()}...`}
          className="w-full outline-none text-sm"
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">Press Enter or comma to add</p>
    </div>
  );
}

export function GuestEditForm({ guest, onSave, onCancel }: GuestEditFormProps) {
  const parseList = (str: string | null) =>
    str ? str.split(',').map(s => s.trim()).filter(Boolean) : [];

  const [allergies, setAllergies] = useState(parseList(guest.allergies));
  const [dietaryPreferences, setDietaryPreferences] = useState(parseList(guest.dietary_preferences));
  const [favoriteCuisines, setFavoriteCuisines] = useState(parseList(guest.favorite_cuisines));
  const [dislikes, setDislikes] = useState(parseList(guest.dislikes));
  const [notes, setNotes] = useState(guest.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        allergies: allergies.join(', '),
        dietary_preferences: dietaryPreferences.join(', '),
        favorite_cuisines: favoriteCuisines.join(', '),
        dislikes: dislikes.join(', '),
        notes
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <TagInput
        label="Allergies"
        value={allergies}
        onChange={setAllergies}
        placeholder="e.g., peanuts, shellfish, dairy..."
        colorClass="bg-red-100 text-red-800"
      />

      <TagInput
        label="Dietary Preferences"
        value={dietaryPreferences}
        onChange={setDietaryPreferences}
        placeholder="e.g., vegetarian, gluten-free, halal..."
        colorClass="bg-green-100 text-green-800"
      />

      <TagInput
        label="Favorite Cuisines"
        value={favoriteCuisines}
        onChange={setFavoriteCuisines}
        placeholder="e.g., Thai, Italian, Mexican..."
        colorClass="bg-blue-100 text-blue-800"
      />

      <TagInput
        label="Dislikes"
        value={dislikes}
        onChange={setDislikes}
        placeholder="e.g., spicy food, mushrooms..."
        colorClass="bg-orange-100 text-orange-800"
      />

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional notes about this guest..."
          rows={4}
          className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
