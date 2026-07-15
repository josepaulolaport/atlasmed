import { updateProfileSchema } from '@atlasmed/access'
import { Elysia } from 'elysia'
import { accessUseCases, auth } from '../../composition'
import { profileRateLimit } from '../middleware/rate-limit.middleware'
import { serializeUser } from './user.serializer'

export const profileRoute = new Elysia()
  .use(auth)
  .use(profileRateLimit)
  .get('/profile', async ({ getUser }) => {
    const user = await getUser()
    return serializeUser(user)
  })
  .patch('/profile', async ({ getUserId, body }: any) => {
    const userId = await getUserId()
    const parsed = updateProfileSchema.parse(body)

    const updatedUser = await accessUseCases.updateProfile().execute({
      userId,
      ...parsed
    })

    return serializeUser(updatedUser)
  })
