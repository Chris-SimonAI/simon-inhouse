'use client';

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { MenuItemDialog } from "./menu-item-dialog";

type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  price: string | null;
  imageUrls: string[] | null;
  isAvailable: boolean;
};

type MenuGroup = {
  id: number;
  name: string;
  description: string | null;
  items: MenuItem[];
};

type MenuTableProps = {
  groups: MenuGroup[];
};

export function MenuTable({ groups }: MenuTableProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleItemClick(item: MenuItem) {
    setSelectedItem(item);
    setDialogOpen(true);
  }

  return (
    <>
      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b">
              <h2 className="text-lg font-semibold text-slate-900">{group.name}</h2>
              {group.description && (
                <p className="text-sm text-slate-500 mt-1">{group.description}</p>
              )}
            </div>
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Image</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider max-w-md">Description</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {group.items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      {item.imageUrls && item.imageUrls.length > 0 ? (
                        <img
                          src={item.imageUrls[0]}
                          alt={item.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center">
                          <ImageOff className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-3 max-w-md">
                      <div className="text-sm text-slate-500 line-clamp-2">{item.description || "—"}</div>
                    </td>
                    <td className="px-6 py-3 text-right font-medium">
                      ${item.price}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {!item.isAvailable ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <MenuItemDialog
        item={selectedItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
