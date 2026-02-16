'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getSchemaTemplates } from '@/lib/actions/schema-templates'
import type { SchemaTemplate } from '@/lib/actions/schema-templates'
import { useToast } from '@/components/ui/toast'
import { FileText } from 'lucide-react'

interface TemplateSelectorProps {
  onSelectTemplate: (template: SchemaTemplate) => void
  onClose: () => void
}

export function TemplateSelector({ onSelectTemplate, onClose }: TemplateSelectorProps) {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<SchemaTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<SchemaTemplate | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const result = await getSchemaTemplates()
      if (result.success && result.templates) {
        setTemplates(result.templates)
      } else {
        showToast('error', result.error || 'שגיאה בטעינת תבניות')
      }
    } catch (error) {
      console.error('Error loading templates:', error)
      showToast('error', 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (template: SchemaTemplate) => {
    setSelectedTemplate(template)
    onSelectTemplate(template)
    onClose()
  }

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    const category = template.category || 'אחר'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(template)
    return acc
  }, {} as Record<string, SchemaTemplate[]>)

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-grey">טוען תבניות...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">בחר תבנית</h3>
        <p className="text-sm text-grey">
          בחר תבנית מוכנה כדי להתחיל מהר, או צור טבלה מותאמת אישית
        </p>
      </div>

      {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
        <div key={category}>
          <h4 className="text-md font-medium mb-3 text-grey">{category}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryTemplates.map((template) => (
              <Card
                key={template.id}
                className="p-4 cursor-pointer hover:border-emerald hover:shadow-md transition-all"
                onClick={() => handleSelect(template)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald" />
                    <h5 className="font-semibold">{template.name}</h5>
                  </div>
                </div>
                <p className="text-sm text-grey mb-3">{template.description}</p>
                <div className="text-xs text-grey">
                  {template.columns.length} עמודות
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <div className="text-center py-8 text-grey">
          <p>אין תבניות זמינות</p>
        </div>
      )}
    </div>
  )
}

