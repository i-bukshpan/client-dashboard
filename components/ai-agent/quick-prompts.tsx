'use client'

interface QuickPromptsProps {
  clientName?: string
  onSelect: (prompt: string) => void
}

const globalPrompts = [
  'מה קורה היום?',
  'אילו משימות דחופות יש לי?',
  'הצג לי פגישות השבוע',
  'מי הלקוחות שלי?',
]

const clientPrompts = (name: string) => [
  `תן לי סיכום מלא על ${name}`,
  `אילו פגישות היו עם ${name}?`,
  `מה המצב הכספי של ${name}?`,
  `הוסף תזכורת עבור ${name}`,
]

export function QuickPrompts({ clientName, onSelect }: QuickPromptsProps) {
  const prompts = clientName ? clientPrompts(clientName) : globalPrompts

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-8 gap-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🤖</div>
        <h3 className="text-base font-semibold text-foreground">עוזר AI</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {clientName ? `שאל אותי על ${clientName}` : 'שאל אותי כל שאלה על המערכת'}
        </p>
      </div>

      <div className="w-full grid grid-cols-1 gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="text-right px-4 py-3 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-sm text-foreground transition-all hover:border-primary/30 active:scale-[0.98]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
