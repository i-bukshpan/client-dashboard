import { z } from 'zod'

const widgetPositionSchema = z.object({
  col: z.number().int().min(0).max(3),
  row: z.number().int().min(0),
  w: z.number().int().min(1).max(4),
  h: z.number().int().min(1).max(4),
})

const widgetFilterSchema = z.object({
  column: z.string().trim().min(1).max(200),
  operator: z.enum(['equals', 'not_equals', 'contains', 'greater_than', 'less_than']),
  value: z.union([z.string().max(500), z.number().finite()]),
})

export const dashboardWidgetSchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: z.enum(['bar_chart', 'line_chart', 'pie_chart', 'stat_card', 'data_table']),
  title: z.string().trim().min(1).max(200),
  sheet: z.string().trim().min(1).max(200),
  tab: z.string().trim().min(1).max(200).optional(),
  position: widgetPositionSchema,
  color: z.string().trim().max(50).optional(),
  aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max', 'net_diff']).optional(),
  net_formula: z.object({
    column: z.string().trim().min(1).max(200),
    type_column: z.string().trim().min(1).max(200),
    positive_value: z.string().max(500),
    negative_value: z.string().max(500),
  }).optional(),
  filters: z.array(widgetFilterSchema).max(20).optional(),
  sort_by: z.string().trim().max(200).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  date_column: z.string().trim().max(200).optional(),
  x_column: z.string().trim().max(200).optional(),
  y_column: z.string().trim().max(200).optional(),
  label_column: z.string().trim().max(200).optional(),
  value_column: z.string().trim().max(200).optional(),
  group_by: z.string().trim().max(200).optional(),
  icon: z.string().trim().max(100).optional(),
  card_color: z.enum(['green', 'red', 'blue', 'amber', 'purple']).optional(),
  prefix: z.string().max(20).optional(),
  suffix: z.string().max(20).optional(),
  columns: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  max_rows: z.number().int().min(1).max(500).optional(),
})

export const dashboardConfigSchema = z.object({
  version: z.literal(1),
  tabs: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  widgets: z.array(dashboardWidgetSchema).max(100),
})

export const dashboardConfigRequestSchema = z.object({
  config: dashboardConfigSchema,
})
