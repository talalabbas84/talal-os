"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInboxEntry,
  updateInboxEntry,
} from "@/features/inbox/actions/inbox.actions";
import type { InboxEntry } from "@/types";

const categories = [
  "IDEA", "TASK", "PROJECT", "GOAL", "JOURNAL",
  "LEARNING", "FINANCE", "HEALTH", "DANCE", "BUSINESS", "PERSONAL",
] as const;

interface Props {
  entry?: InboxEntry;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function InboxEntryDialog({ entry, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(entry?.category ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);

    const payload = {
      title: data.get("title"),
      description: data.get("description") || undefined,
      category: category || undefined,
    };

    startTransition(async () => {
      const result = entry
        ? await updateInboxEntry(entry.id, payload)
        : await createInboxEntry(payload);

      if (result.success) {
        setOpen(false);
        onSuccess?.();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Entry" : "New Inbox Entry"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={entry?.title}
              placeholder="What's on your mind?"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={entry?.description ?? ""}
              placeholder="Any details…"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : entry ? "Update" : "Add to Inbox"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
