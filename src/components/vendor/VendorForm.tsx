"use client";

import { Checkbox } from "@/components/common/Checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type VendorFormProps = {
  vendorName: string;
  setVendorName: (value: string) => void;
  vendorType: string;
  setVendorType: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  contactPerson: string;
  setContactPerson: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
};

const vendorTypes = ["MERCHANDISE", "EXPENSE", "EMPLOYEE"];

export function VendorForm({
  vendorName,
  setVendorName,
  vendorType,
  setVendorType,
  description,
  setDescription,
  contactPerson,
  setContactPerson,
  email,
  setEmail,
  phone,
  setPhone,
  address,
  setAddress,
  onCancel,
  onSubmit,
  submitting,
}: VendorFormProps) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-6 space-y-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Vendor Details</h2>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Vendor name<span className="text-red-500">*</span>
        </label>
        <Input
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          placeholder="LP Food Mart"
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Vendor Type</p>
        <div className="flex flex-wrap gap-6">
          {vendorTypes.map((type) => (
            <Checkbox
              key={type}
              checked={vendorType === type}
              onChange={(checked) => {
                if (checked) setVendorType(type);
              }}
              label={<span className="uppercase tracking-tight text-xs md:text-sm">{type}</span>}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Description<span className="text-red-500">*</span>
        </label>
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter a short description..."
          className="min-h-[96px]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm text-foreground">Contact Person</label>
          <Input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-foreground">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vendor@example.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-foreground">Phone</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="555-123-4567"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm text-foreground">Address</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          className="bg-muted text-foreground hover:bg-muted/80"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Update"}
        </Button>
      </div>
    </div>
  );
}

