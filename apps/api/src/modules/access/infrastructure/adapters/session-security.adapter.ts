import { sessionSecurityService } from "../../../../infrastructure/security/session-security.service";
import type { ISessionSecurityService } from "../../application/interfaces/session-security.interface";

export const sessionSecurityAdapter: ISessionSecurityService = sessionSecurityService;
