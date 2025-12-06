import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { ArrowLeft, FileText, Save, Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface ContentManagementProps {
  onBack?: () => void;
}

interface ContentPage {
  id: string;
  page_type: 'help_center' | 'terms_of_service' | 'privacy_policy';
  title: string;
  content: any;
  updated_at: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface ContactItem {
  type: string;
  label: string;
  value: string;
}

interface Section {
  heading: string;
  content: string;
}

export default function ContentManagement({ onBack }: ContentManagementProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPage, setSelectedPage] = useState<'help_center' | 'terms_of_service' | 'privacy_policy'>('help_center');
  const [contentPages, setContentPages] = useState<Record<string, ContentPage>>({});

  const [helpCenterFAQs, setHelpCenterFAQs] = useState<FAQItem[]>([]);
  const [helpCenterContacts, setHelpCenterContacts] = useState<ContactItem[]>([]);
  const [termsLastUpdated, setTermsLastUpdated] = useState('');
  const [termsSections, setTermsSections] = useState<Section[]>([]);
  const [privacyLastUpdated, setPrivacyLastUpdated] = useState('');
  const [privacySections, setPrivacySections] = useState<Section[]>([]);

  useEffect(() => {
    fetchContentPages();
  }, []);

  const fetchContentPages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('content_pages')
        .select('*')
        .order('page_type');

      if (error) throw error;

      const pagesMap: Record<string, ContentPage> = {};
      data?.forEach((page) => {
        pagesMap[page.page_type] = page;
      });

      setContentPages(pagesMap);
      loadPageData(pagesMap);
    } catch (error) {
      console.error('Error fetching content pages:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to fetch content pages');
      } else {
        Alert.alert('Error', 'Failed to fetch content pages');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPageData = (pages: Record<string, ContentPage>) => {
    if (pages.help_center) {
      const content = pages.help_center.content;
      setHelpCenterFAQs(content.sections?.[0]?.items || []);
      setHelpCenterContacts(content.sections?.[1]?.items || []);
    }

    if (pages.terms_of_service) {
      const content = pages.terms_of_service.content;
      setTermsLastUpdated(content.lastUpdated || '');
      setTermsSections(content.sections || []);
    }

    if (pages.privacy_policy) {
      const content = pages.privacy_policy.content;
      setPrivacyLastUpdated(content.lastUpdated || '');
      setPrivacySections(content.sections || []);
    }
  };

  const saveContent = async () => {
    try {
      setSaving(true);

      let content: any = {};

      if (selectedPage === 'help_center') {
        content = {
          sections: [
            {
              title: 'Frequently Asked Questions',
              items: helpCenterFAQs,
            },
            {
              title: 'Contact Support',
              items: helpCenterContacts,
            },
          ],
        };
      } else if (selectedPage === 'terms_of_service') {
        content = {
          lastUpdated: termsLastUpdated,
          sections: termsSections,
        };
      } else if (selectedPage === 'privacy_policy') {
        content = {
          lastUpdated: privacyLastUpdated,
          sections: privacySections,
        };
      }

      const { error } = await supabase
        .from('content_pages')
        .update({
          content,
          last_updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('page_type', selectedPage);

      if (error) throw error;

      if (Platform.OS === 'web') {
        window.alert('Content updated successfully');
      } else {
        Alert.alert('Success', 'Content updated successfully');
      }
      await fetchContentPages();
    } catch (error: any) {
      console.error('Error saving content:', error);
      if (Platform.OS === 'web') {
        window.alert(error.message || 'Failed to save content');
      } else {
        Alert.alert('Error', error.message || 'Failed to save content');
      }
    } finally {
      setSaving(false);
    }
  };

  const addFAQ = () => {
    console.log('Adding new FAQ');
    const newFAQs = [...helpCenterFAQs, { question: '', answer: '' }];
    setHelpCenterFAQs(newFAQs);
    console.log('FAQs after adding:', newFAQs.length);
  };

  const updateFAQ = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...helpCenterFAQs];
    updated[index][field] = value;
    setHelpCenterFAQs(updated);
  };

  const removeFAQ = (index: number) => {
    setHelpCenterFAQs(helpCenterFAQs.filter((_, i) => i !== index));
  };

  const addContact = () => {
    console.log('Adding new contact');
    const newContacts = [...helpCenterContacts, { type: 'email', label: '', value: '' }];
    setHelpCenterContacts(newContacts);
    console.log('Contacts after adding:', newContacts.length);
  };

  const updateContact = (index: number, field: 'type' | 'label' | 'value', value: string) => {
    const updated = [...helpCenterContacts];
    updated[index][field] = value;
    setHelpCenterContacts(updated);
  };

  const removeContact = (index: number) => {
    setHelpCenterContacts(helpCenterContacts.filter((_, i) => i !== index));
  };

  const addSection = (type: 'terms' | 'privacy') => {
    const newSection = { heading: '', content: '' };
    if (type === 'terms') {
      setTermsSections([...termsSections, newSection]);
    } else {
      setPrivacySections([...privacySections, newSection]);
    }
  };

  const updateSection = (
    type: 'terms' | 'privacy',
    index: number,
    field: 'heading' | 'content',
    value: string
  ) => {
    if (type === 'terms') {
      const updated = [...termsSections];
      updated[index][field] = value;
      setTermsSections(updated);
    } else {
      const updated = [...privacySections];
      updated[index][field] = value;
      setPrivacySections(updated);
    }
  };

  const removeSection = (type: 'terms' | 'privacy', index: number) => {
    if (type === 'terms') {
      setTermsSections(termsSections.filter((_, i) => i !== index));
    } else {
      setPrivacySections(privacySections.filter((_, i) => i !== index));
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Content Management</Text>
            <Text style={styles.subtitle}>Manage app content pages</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedPage === 'help_center' && styles.activeTab]}
          onPress={() => setSelectedPage('help_center')}
        >
          <Text style={[styles.tabText, selectedPage === 'help_center' && styles.activeTabText]}>
            Help Center
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedPage === 'terms_of_service' && styles.activeTab]}
          onPress={() => setSelectedPage('terms_of_service')}
        >
          <Text style={[styles.tabText, selectedPage === 'terms_of_service' && styles.activeTabText]}>
            Terms
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedPage === 'privacy_policy' && styles.activeTab]}
          onPress={() => setSelectedPage('privacy_policy')}
        >
          <Text style={[styles.tabText, selectedPage === 'privacy_policy' && styles.activeTabText]}>
            Privacy
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {selectedPage === 'help_center' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>FAQs ({helpCenterFAQs.length})</Text>
              <TouchableOpacity style={styles.addButton} onPress={addFAQ}>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addButtonText}>Add FAQ</Text>
              </TouchableOpacity>
            </View>
            {helpCenterFAQs.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No FAQs yet. Click "Add FAQ" to create one.</Text>
              </View>
            )}
            {helpCenterFAQs.map((faq, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>FAQ {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeFAQ(index)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Question</Text>
                <TextInput
                  style={styles.input}
                  value={faq.question}
                  onChangeText={(text) => updateFAQ(index, 'question', text)}
                  placeholder="Enter question"
                  multiline
                />
                <Text style={styles.label}>Answer</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={faq.answer}
                  onChangeText={(text) => updateFAQ(index, 'answer', text)}
                  placeholder="Enter answer"
                  multiline
                  numberOfLines={4}
                />
              </View>
            ))}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Contact Support ({helpCenterContacts.length})</Text>
              <TouchableOpacity style={styles.addButton} onPress={addContact}>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addButtonText}>Add Contact</Text>
              </TouchableOpacity>
            </View>
            {helpCenterContacts.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No contact info yet. Click "Add Contact" to create one.</Text>
              </View>
            )}
            {helpCenterContacts.map((contact, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Contact {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeContact(index)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Type</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={[styles.pickerOption, contact.type === 'email' && styles.pickerOptionActive]}
                    onPress={() => updateContact(index, 'type', 'email')}
                  >
                    <Text style={[styles.pickerOptionText, contact.type === 'email' && styles.pickerOptionTextActive]}>Email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerOption, contact.type === 'phone' && styles.pickerOptionActive]}
                    onPress={() => updateContact(index, 'type', 'phone')}
                  >
                    <Text style={[styles.pickerOptionText, contact.type === 'phone' && styles.pickerOptionTextActive]}>Phone</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerOption, contact.type === 'chat' && styles.pickerOptionActive]}
                    onPress={() => updateContact(index, 'type', 'chat')}
                  >
                    <Text style={[styles.pickerOptionText, contact.type === 'chat' && styles.pickerOptionTextActive]}>Chat</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Label</Text>
                <TextInput
                  style={styles.input}
                  value={contact.label}
                  onChangeText={(text) => updateContact(index, 'label', text)}
                  placeholder="e.g., Email Support"
                />
                <Text style={styles.label}>Value</Text>
                <TextInput
                  style={styles.input}
                  value={contact.value}
                  onChangeText={(text) => updateContact(index, 'value', text)}
                  placeholder="e.g., support@example.com"
                />
              </View>
            ))}
          </View>
        )}

        {selectedPage === 'terms_of_service' && (
          <View style={styles.section}>
            <Text style={styles.label}>Last Updated</Text>
            <TextInput
              style={styles.input}
              value={termsLastUpdated}
              onChangeText={setTermsLastUpdated}
              placeholder="e.g., November 30, 2025"
            />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sections</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => addSection('terms')}>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addButtonText}>Add Section</Text>
              </TouchableOpacity>
            </View>
            {termsSections.map((section, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Section {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeSection('terms', index)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Heading</Text>
                <TextInput
                  style={styles.input}
                  value={section.heading}
                  onChangeText={(text) => updateSection('terms', index, 'heading', text)}
                  placeholder="Enter heading"
                />
                <Text style={styles.label}>Content</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={section.content}
                  onChangeText={(text) => updateSection('terms', index, 'content', text)}
                  placeholder="Enter content"
                  multiline
                  numberOfLines={4}
                />
              </View>
            ))}
          </View>
        )}

        {selectedPage === 'privacy_policy' && (
          <View style={styles.section}>
            <Text style={styles.label}>Last Updated</Text>
            <TextInput
              style={styles.input}
              value={privacyLastUpdated}
              onChangeText={setPrivacyLastUpdated}
              placeholder="e.g., November 30, 2025"
            />
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sections</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => addSection('privacy')}>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.addButtonText}>Add Section</Text>
              </TouchableOpacity>
            </View>
            {privacySections.map((section, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Section {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeSection('privacy', index)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>Heading</Text>
                <TextInput
                  style={styles.input}
                  value={section.heading}
                  onChangeText={(text) => updateSection('privacy', index, 'heading', text)}
                  placeholder="Enter heading"
                />
                <Text style={styles.label}>Content</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={section.content}
                  onChangeText={(text) => updateSection('privacy', index, 'content', text)}
                  placeholder="Enter content"
                  multiline
                  numberOfLines={4}
                />
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveContent}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Save size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#e0f2fe',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#ff8c00',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#ff8c00',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff8c00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff8c00',
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyState: {
    backgroundColor: '#f8fafc',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  pickerOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  pickerOptionActive: {
    borderColor: '#ff8c00',
    backgroundColor: '#ffedd5',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  pickerOptionTextActive: {
    color: '#ff8c00',
  },
});
