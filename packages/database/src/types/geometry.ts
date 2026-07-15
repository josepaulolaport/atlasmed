import { customType } from 'drizzle-orm/pg-core'

export const geometryPoint = customType<{
  data: string
  driverData: string
}>({
  dataType() {
    return 'geometry(Point,4326)'
  }
})

export const geometryMultiPolygon = customType<{
  data: string
  driverData: string
}>({
  dataType() {
    return 'geometry(MultiPolygon,4326)'
  }
})
