/**
 * API Documentation Configuration
 * 
 * Comprehensive OpenAPI documentation for the AtlasMed API.
 */

import { API_VERSION } from "./versioning";

export const apiDocumentation = {
  openapi: '3.1.0',
  info: {
    title: 'AtlasMed API',
    version: '1.0.0',
    description: `
# AtlasMed Healthcare Platform API

Complete API for authentication, user management, and healthcare operations.

## Base URL

\`\`\`
http://localhost:3000/api/${API_VERSION}
\`\`\`

## Authentication

Most endpoints require authentication via Bearer token in the Authorization header:

\`\`\`
Authorization: Bearer <your-access-token>
\`\`\`

### Getting an Access Token

1. Login via \`POST /api/${API_VERSION}/access/login\`
2. Use the returned \`accessToken\` in the Authorization header
3. Token expires after 15 minutes (configurable)
4. Use \`refreshToken\` to get a new access token

## Rate Limiting

API requests are rate limited to prevent abuse:

- **100 requests per 15 minutes** per IP for unauthenticated requests
- **1000 requests per 15 minutes** per user for authenticated requests

Rate limit information is included in response headers:

| Header | Description |
|--------|-------------|
| \`X-RateLimit-Limit\` | Maximum requests allowed in the window |
| \`X-RateLimit-Remaining\` | Remaining requests in current window |
| \`X-RateLimit-Reset\` | Unix timestamp when limit resets |

When rate limited, you'll receive a \`429 Too Many Requests\` response with a \`Retry-After\` header.

## Request Tracking

Every response includes a request ID for tracing:

\`\`\`
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
\`\`\`

You can provide your own request ID by including it in the request:

\`\`\`
X-Request-ID: my-custom-trace-id
\`\`\`

Use request IDs when reporting issues to support for faster resolution.

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "context": {
      // Optional: Additional error context
    }
  }
}
\`\`\`

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| \`INVALID_CREDENTIALS\` | 401 | Invalid email or password |
| \`SESSION_EXPIRED\` | 401 | Session has expired, login again |
| \`TOKEN_INVALID\` | 401 | Authentication token is invalid |
| \`INSUFFICIENT_PERMISSIONS\` | 403 | User lacks required permissions |
| \`ACCOUNT_SUSPENDED\` | 403 | Account has been suspended |
| \`RESOURCE_NOT_FOUND\` | 404 | Resource does not exist |
| \`EMAIL_ALREADY_EXISTS\` | 409 | Email is already registered |
| \`VALIDATION_ERROR\` | 400 | Request validation failed |
| \`RATE_LIMIT_EXCEEDED\` | 429 | Too many requests |
| \`INTERNAL_SERVER_ERROR\` | 500 | Unexpected server error |

See the full [Error Codes Reference](/docs/errors) for complete documentation.

## Pagination

List endpoints support cursor-based pagination:

\`\`\`
GET /api/${API_VERSION}/resource?limit=20&cursor=eyJpZCI6MTIzfQ
\`\`\`

**Query Parameters:**
- \`limit\`: Number of items per page (default: 20, max: 100)
- \`cursor\`: Opaque cursor for next page

**Response:**
\`\`\`json
{
  "data": [...],
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6MTQzfQ"
  }
}
\`\`\`

## Versioning

The API uses URL versioning for clarity and stability:

- Current version: **${API_VERSION}**
- Base path: \`/api/${API_VERSION}\`
- Breaking changes will result in new versions (v2, v3, etc.)
- Previous versions maintained for 6 months after deprecation

## Health & Monitoring

Check API health and monitor status:

| Endpoint | Purpose |
|----------|---------|
| \`GET /health/live\` | Liveness probe (is API running?) |
| \`GET /health/ready\` | Readiness probe (can serve traffic?) |
| \`GET /health\` | Detailed health with system metrics |
| \`GET /health/metrics\` | Prometheus metrics |

## Best Practices

### Security
- Always use HTTPS in production
- Store tokens securely (never in localStorage for web apps)
- Refresh tokens before they expire
- Implement proper CORS policies

### Performance
- Use pagination for list endpoints
- Cache responses when appropriate
- Batch requests when possible
- Monitor rate limit headers

### Error Handling
- Always check error codes, not messages
- Display user-friendly messages based on error codes
- Log request IDs for debugging
- Implement retry logic for transient errors

### Testing
- Use separate API keys for testing
- Test error scenarios
- Validate rate limiting behavior
- Check pagination edge cases

## Support

Need help?
- Check our [Error Codes Reference](/docs/errors)
- Review endpoint documentation below
- Contact support with request IDs for issues

---

**Current Version:** ${API_VERSION}  
**Last Updated:** 2026-05-25
    `,
    contact: {
      name: 'AtlasMed Support',
      email: 'support@atlasmed.com',
      url: 'https://support.atlasmed.com'
    },
    license: {
      name: 'Proprietary',
      url: 'https://atlasmed.com/license'
    }
  },
  
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server'
    },
    {
      url: 'https://api-staging.atlasmed.com',
      description: 'Staging environment (for testing)'
    },
    {
      url: 'https://api.atlasmed.com',
      description: 'Production environment'
    }
  ],
  
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and session management endpoints'
    },
    {
      name: 'Users',
      description: 'User management and profile operations'
    },
    {
      name: 'Invitations',
      description: 'User invitation system for onboarding'
    },
    {
      name: 'Sessions',
      description: 'Session management and token refresh'
    },
    {
      name: 'Password',
      description: 'Password reset and management'
    },
    {
      name: 'Roles',
      description: 'Role and permission management'
    },
    {
      name: 'Health',
      description: 'Service health monitoring and metrics'
    }
  ],
  
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from the login endpoint. Include in Authorization header as: `Bearer <token>`'
      }
    },
    
    schemas: {
      // Common response schemas
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                example: 'RESOURCE_NOT_FOUND',
                description: 'Machine-readable error code'
              },
              message: {
                type: 'string',
                example: 'The requested resource was not found',
                description: 'Human-readable error message'
              },
              context: {
                type: 'object',
                additionalProperties: true,
                description: 'Additional error context for debugging'
              }
            }
          }
        }
      },
      
      Pagination: {
        type: 'object',
        properties: {
          hasMore: {
            type: 'boolean',
            description: 'Whether there are more items available'
          },
          nextCursor: {
            type: 'string',
            nullable: true,
            description: 'Opaque cursor for fetching the next page'
          },
          total: {
            type: 'integer',
            description: 'Total number of items (if available)'
          }
        }
      }
    },
    
    responses: {
      UnauthorizedError: {
        description: 'Authentication required or credentials are invalid',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            examples: {
              invalidCredentials: {
                value: {
                  error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password'
                  }
                },
                summary: 'Invalid credentials'
              },
              sessionExpired: {
                value: {
                  error: {
                    code: 'SESSION_EXPIRED',
                    message: 'Your session has expired. Please login again.'
                  }
                },
                summary: 'Session expired'
              },
              tokenInvalid: {
                value: {
                  error: {
                    code: 'TOKEN_INVALID',
                    message: 'Invalid or malformed authentication token'
                  }
                },
                summary: 'Invalid token'
              }
            }
          }
        }
      },
      
      ForbiddenError: {
        description: 'Insufficient permissions to perform this action',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            examples: {
              insufficientPermissions: {
                value: {
                  error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to perform this action',
                    context: {
                      required: ['admin'],
                      has: ['user']
                    }
                  }
                },
                summary: 'Insufficient permissions'
              },
              accountSuspended: {
                value: {
                  error: {
                    code: 'ACCOUNT_SUSPENDED',
                    message: 'Your account has been suspended'
                  }
                },
                summary: 'Account suspended'
              }
            }
          }
        }
      },
      
      NotFoundError: {
        description: 'The requested resource was not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'RESOURCE_NOT_FOUND',
                message: 'User not found',
                context: {
                  resource: 'User',
                  identifier: '123'
                }
              }
            }
          }
        }
      },
      
      ValidationError: {
        description: 'Request validation failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                context: {
                  errors: [
                    { field: 'email', message: 'Invalid email format' },
                    { field: 'password', message: 'Password too short' }
                  ]
                }
              }
            }
          }
        }
      },
      
      ConflictError: {
        description: 'Resource already exists or conflicts with existing data',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            examples: {
              emailExists: {
                value: {
                  error: {
                    code: 'EMAIL_ALREADY_EXISTS',
                    message: 'An account with this email already exists',
                    context: {
                      email: 'user@example.com'
                    }
                  }
                },
                summary: 'Email already exists'
              },
              usernameExists: {
                value: {
                  error: {
                    code: 'USERNAME_ALREADY_EXISTS',
                    message: 'This username is already taken',
                    context: {
                      username: 'johndoe'
                    }
                  }
                },
                summary: 'Username already taken'
              }
            }
          }
        }
      },
      
      RateLimitError: {
        description: 'Rate limit exceeded - too many requests',
        headers: {
          'X-RateLimit-Limit': {
            schema: { type: 'integer' },
            description: 'Maximum requests allowed in the time window'
          },
          'X-RateLimit-Remaining': {
            schema: { type: 'integer' },
            description: 'Remaining requests in current window'
          },
          'X-RateLimit-Reset': {
            schema: { type: 'integer' },
            description: 'Unix timestamp when the limit resets'
          },
          'Retry-After': {
            schema: { type: 'integer' },
            description: 'Seconds to wait before retrying'
          }
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please try again later.',
                context: {
                  retryAfter: 900000,
                  retryAfterSeconds: 900
                }
              }
            }
          }
        }
      },
      
      InternalServerError: {
        description: 'Internal server error - something went wrong on our end',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred. Please try again later.'
              }
            }
          }
        }
      }
    },
    
    parameters: {
      RequestId: {
        name: 'X-Request-ID',
        in: 'header',
        description: 'Optional request ID for tracing. If not provided, one will be generated.',
        schema: {
          type: 'string',
          format: 'uuid'
        },
        example: '550e8400-e29b-41d4-a716-446655440000'
      }
    }
  }
};
