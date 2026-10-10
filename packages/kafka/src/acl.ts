// Kafka's built-in authorizer (StandardAuthorizer in KRaft), reduced to what a
// learner meets first: who (a principal) may do what (an operation) to which
// topic or group. A request needs an ALLOW that matches and no DENY that
// matches; with no matching ACL at all it is refused, because
// allow.everyone.if.no.acl.found is false by default.

export type AclOperation = 'Read' | 'Write' | 'Describe' | 'All';
export type AclResource = 'topic' | 'group';
export type AclPattern = 'literal' | 'prefixed';
export type AclPermission = 'Allow' | 'Deny';

export interface Acl {
  /** `User:name`, or `User:*` for everyone. */
  principal: string;
  resource: AclResource;
  /** A topic or group name; `*` with a literal pattern means every one. */
  name: string;
  pattern: AclPattern;
  operation: AclOperation;
  permission: AclPermission;
}

export const ACL_OPERATIONS: readonly AclOperation[] = ['Read', 'Write', 'Describe', 'All'];

/** super.users: the CLI tools here run as this principal, which skips every check. */
export const SUPER_USER = 'User:admin';

const nameMatches = (a: Acl, name: string) =>
  a.pattern === 'prefixed' ? name.startsWith(a.name) : a.name === '*' || a.name === name;

/** Read and Write each imply Describe; All implies everything. */
const opMatches = (a: Acl, op: AclOperation) =>
  a.operation === 'All' ||
  a.operation === op ||
  (op === 'Describe' &&
    a.permission === 'Allow' &&
    (a.operation === 'Read' || a.operation === 'Write'));

const matches = (
  a: Acl,
  principal: string,
  resource: AclResource,
  name: string,
  op: AclOperation,
) =>
  (a.principal === principal || a.principal === 'User:*') &&
  a.resource === resource &&
  nameMatches(a, name) &&
  opMatches(a, op);

export function authorize(
  acls: readonly Acl[],
  principal: string,
  resource: AclResource,
  name: string,
  op: AclOperation,
): boolean {
  if (principal === SUPER_USER) return true;
  const hits = acls.filter((a) => matches(a, principal, resource, name, op));
  return hits.length > 0 && hits.every((a) => a.permission === 'Allow');
}

export const sameAcl = (a: Acl, b: Acl) =>
  a.principal === b.principal &&
  a.resource === b.resource &&
  a.name === b.name &&
  a.pattern === b.pattern &&
  a.operation === b.operation &&
  a.permission === b.permission;

/** `User:billing-1 has Allow permission for operations: Read from hosts: *` and its resource line. */
export function describeAcl(a: Acl): string {
  return `(principal=${a.principal}, host=*, operation=${a.operation.toUpperCase()}, permissionType=${a.permission.toUpperCase()})`;
}

export const resourceLine = (resource: AclResource, name: string, pattern: AclPattern) =>
  `Current ACLs for resource \`ResourcePattern(resourceType=${resource.toUpperCase()}, name=${name}, patternType=${pattern.toUpperCase()})\`:`;
