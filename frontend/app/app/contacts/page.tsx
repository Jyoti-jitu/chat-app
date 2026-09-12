"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Plus, Phone, Video, MessageSquare, Trash2, CheckCircle2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { mockUsers } from "@/lib/mock/users";
import { User } from "@/types/user";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<User[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<User | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineContacts = filteredContacts.filter((c) => c.isOnline);
  const offlineContacts = filteredContacts.filter((c) => !c.isOnline);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) return;

    const newContact: User = {
      id: `u_${Date.now()}`,
      name: newContactName.trim(),
      username: newContactName.trim().toLowerCase().replace(/\s+/g, ""),
      email: newContactEmail || `${newContactName.trim().toLowerCase()}@example.com`,
      isOnline: true,
      bio: "New contact added to FluxChat.",
      joinedDate: "Today",
    };

    setContacts((prev) => [newContact, ...prev]);
    setIsAddModalOpen(false);
    setNewContactName("");
    setNewContactEmail("");
    setToastMessage(`Contact "${newContact.name}" added successfully.`);
    setTimeout(() => setToastMessage(""), 2500);
  };

  const handleConfirmDeleteContact = () => {
    if (!contactToDelete) return;
    const name = contactToDelete.name;
    setContacts((prev) => prev.filter((c) => c.id !== contactToDelete.id));
    setContactToDelete(null);
    setToastMessage(`Contact "${name}" was deleted.`);
    setTimeout(() => setToastMessage(""), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] dark:bg-[#101614] overflow-hidden transition-colors relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 right-6 z-40 p-3 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold flex items-center gap-2 shadow-flux-md animate-in fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header matching panel 7 */}
      <div className="h-16 px-6 sm:px-8 flex items-center justify-between border-b border-[#E6EBE8] dark:border-[#212E29]">
        <h1 className="text-xl font-bold text-[#17211D] dark:text-[#F1F5F3]">
          Contacts
        </h1>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Contact
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full flex-1 overflow-y-auto space-y-6">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-[#66736D] dark:text-[#8E9C95] pointer-events-none" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-[#F7F9F8] dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] pl-10 pr-4 py-2.5 text-sm text-[#17211D] dark:text-[#F1F5F3] placeholder:text-[#9BA7A1] dark:placeholder:text-[#66736D] focus:outline-none focus:bg-white dark:focus:bg-[#151D1A] focus:border-[#168F67] focus:ring-2 focus:ring-[#168F67]/15 transition-all shadow-xs"
          />
        </div>

        {/* Section: Online Contacts */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
            Online ({onlineContacts.length})
          </h2>
          <div className="space-y-2">
            {onlineContacts.length > 0 ? (
              onlineContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] hover:border-[#CFD6D2] dark:hover:border-[#2F3F38] shadow-xs transition-all group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar
                      name={contact.name}
                      src={contact.avatar}
                      size="md"
                      isOnline={contact.isOnline}
                    />
                    <div className="min-w-0 text-left">
                      <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                        {contact.name}
                      </h3>
                      <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate">
                        @{contact.username}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alert(`Calling ${contact.name}...`)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-[#66736D] hover:text-[#168F67] rounded-lg transition-all hidden sm:block cursor-pointer"
                      title={`Call ${contact.name}`}
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Video calling ${contact.name}...`)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-[#66736D] hover:text-[#168F67] rounded-lg transition-all hidden sm:block cursor-pointer"
                      title={`Video call ${contact.name}`}
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactToDelete(contact)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-[#66736D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                      title={`Delete ${contact.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link href="/app/chats/c1">
                      <Button variant="soft" size="sm" leftIcon={<MessageSquare className="w-3.5 h-3.5" />}>
                        Message
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl text-center text-xs text-[#66736D] dark:text-[#8E9C95] border border-dashed border-[#E6EBE8] dark:border-[#212E29]">
                No online contacts right now.
              </div>
            )}
          </div>
        </div>

        {/* Section: Offline Contacts */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#66736D] dark:text-[#8E9C95]">
            Offline ({offlineContacts.length})
          </h2>
          <div className="space-y-2">
            {offlineContacts.length > 0 ? (
              offlineContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#151D1A] border border-[#E6EBE8] dark:border-[#212E29] hover:border-[#CFD6D2] dark:hover:border-[#2F3F38] shadow-xs transition-all group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar
                      name={contact.name}
                      src={contact.avatar}
                      size="md"
                      isOnline={contact.isOnline}
                    />
                    <div className="min-w-0 text-left">
                      <h3 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3] truncate">
                        {contact.name}
                      </h3>
                      <p className="text-xs text-[#66736D] dark:text-[#8E9C95] truncate">
                        @{contact.username} • {contact.lastSeen || "Offline"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setContactToDelete(contact)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-[#66736D] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                      title={`Delete ${contact.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link href="/app/chats/c1">
                      <Button variant="secondary" size="sm">
                        Message
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-xl text-center text-xs text-[#66736D] dark:text-[#8E9C95] border border-dashed border-[#E6EBE8] dark:border-[#212E29]">
                No offline contacts.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Contact Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add new contact"
        description="Enter the contact details below to send a connection request."
      >
        <form onSubmit={handleAddContact} className="space-y-4">
          <Input
            id="contactName"
            label="Name"
            placeholder="e.g. Taylor Swift"
            value={newContactName}
            onChange={(e) => setNewContactName(e.target.value)}
            required
          />
          <Input
            id="contactEmail"
            label="Email or Username"
            placeholder="taylor@example.com"
            value={newContactEmail}
            onChange={(e) => setNewContactEmail(e.target.value)}
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Add Contact</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Contact Confirmation Modal */}
      <Modal
        isOpen={Boolean(contactToDelete)}
        onClose={() => setContactToDelete(null)}
        title="Delete Contact"
        size="sm"
      >
        <div className="space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#17211D] dark:text-[#F1F5F3]">
                Delete &ldquo;{contactToDelete?.name}&rdquo;?
              </h4>
              <p className="text-xs text-[#66736D] dark:text-[#8E9C95] mt-1 leading-relaxed">
                Are you sure you want to remove this contact? You can add them back later with their username or email.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6EBE8] dark:border-[#212E29]">
            <Button variant="outline" size="sm" onClick={() => setContactToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDeleteContact}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Contact</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
