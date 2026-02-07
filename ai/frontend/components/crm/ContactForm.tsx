/**
 * ContactForm Component
 * 
 * Form for creating and editing contacts in the CRM.
 * Features: email, name, phone, company selection, tags, custom fields
 * Includes validation, error handling, and real-time AI recommendations
 */

import React, { useState, useEffect } from 'react';
function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

interface CustomField {
  [key: string]: string | number | boolean;
}

interface ContactFormProps {
  contactId?: string;
  onSave: (contactData: ContactFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface ContactFormData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  title?: string;
  company_id?: string;
  tags: string[];
  custom_fields: CustomField;
}

interface AIRecommendation {
  type: 'title' | 'company' | 'tags';
  suggestion: string;
  confidence: number;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  contactId,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<ContactFormData>({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    title: '',
    company_id: '',
    tags: [],
    custom_fields: {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (contactId) {
      // TODO: Implement fetch contact
    }
  }, [contactId]);

  const fetchAIRecommendations = debounce(async (email: string) => {
    if (!email || !email.includes('@')) return;
    try {
      const response = await fetch('/api/v1/copilot/enrich-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setAiRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Failed to fetch AI recommendations:', error);
    }
  }, 500);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await onSave(formData);
    } catch (error) {
      setErrors({ submit: 'Failed to save contact. Please try again.' });
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === 'email') {
      fetchAIRecommendations(value);
    }
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const applyRecommendation = (recommendation: AIRecommendation) => {
    switch (recommendation.type) {
      case 'title':
        setFormData((prev) => ({
          ...prev,
          title: recommendation.suggestion,
        }));
        break;
      case 'company':
        setFormData((prev) => ({
          ...prev,
          company_id: recommendation.suggestion,
        }));
        break;
      case 'tags':
        setFormData((prev) => ({
          ...prev,
          tags: [...prev.tags, recommendation.suggestion],
        }));
        break;
    }
    setAiRecommendations((prev) =>
      prev.filter((r) => r.suggestion !== recommendation.suggestion)
    );
  };

  const handleAddTag = (tag: string) => {
    if (!formData.tags.includes(tag) && tag.trim()) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag.trim()],
      }));
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  return (
    <div className="contact-form max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6">
        {contactId ? 'Edit Contact' : 'Create New Contact'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-2 px-3 py-2 ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="john@example.com"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md border-2 px-3 py-2 ${
                errors.first_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="John"
              disabled={isLoading}
            />
            {errors.first_name && (
              <p className="mt-1 text-sm text-red-500">{errors.first_name}</p>
            )}
          </div>
          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md border-2 px-3 py-2 ${
                errors.last_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Smith"
              disabled={isLoading}
            />
            {errors.last_name && (
              <p className="mt-1 text-sm text-red-500">{errors.last_name}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-2 border-gray-300 px-3 py-2"
              placeholder="+1 (555) 123-4567"
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-2 border-gray-300 px-3 py-2"
              placeholder="VP Sales"
              disabled={isLoading}
            />
          </div>
        </div>
        {aiRecommendations.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">💡 AI Suggestions (Click to apply)</h3>
            <div className="space-y-2">
              {aiRecommendations.map((rec, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyRecommendation(rec)}
                  className="w-full text-left p-2 bg-white hover:bg-blue-100 rounded border border-blue-200 transition"
                >
                  <span className="font-medium">{rec.type}:</span> {rec.suggestion}
                  <span className="text-xs text-gray-500 ml-2">
                    ({Math.round(rec.confidence * 100)}% confidence)
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label htmlFor="company_id" className="block text-sm font-medium text-gray-700">
            Company
          </label>
          <select
            id="company_id"
            name="company_id"
            value={formData.company_id}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-2 border-gray-300 px-3 py-2"
            disabled={isLoading}
          >
            <option value="">Select a company...</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="font-bold hover:text-blue-600"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add tag..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
              className="flex-1 rounded-md border-2 border-gray-300 px-3 py-2"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                handleAddTag(input.value);
                input.value = '';
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition disabled:opacity-50"
              disabled={isLoading}
            >
              Add
            </button>
          </div>
        </div>
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {errors.submit}
          </div>
        )}
        <div className="flex gap-4 justify-end pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : contactId ? 'Update Contact' : 'Create Contact'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContactForm;
