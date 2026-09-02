const ADMINISTRATIVE_AREA_PATTERN =
  /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,4})?$/;
const ADMINISTRATIVE_AREA_MAXIMUM = '9999999999.9999';

declare const administrativeAreaBrand: unique symbol;

export type AdministrativeAreaTotal = string & {
  readonly [administrativeAreaBrand]: true;
};

export interface CreateAdministrativePropertyPayload {
  readonly nome: string;
  readonly titular_id: string;
  readonly municipio_id: string;
  readonly area_total?: AdministrativeAreaTotal;
  readonly cultura_principal?: string;
  readonly status: 'ativa' | 'inativa';
}

export interface PatchAdministrativePropertyPayload {
  readonly versao: number;
  readonly nome?: string;
  readonly municipio_id?: string;
  readonly area_total?: AdministrativeAreaTotal | null;
  readonly cultura_principal?: string | null;
}

export class InvalidAdministrativeAreaError extends Error {
  constructor() {
    super('A área total deve ser um decimal textual positivo válido.');
    this.name = 'InvalidAdministrativeAreaError';
  }
}

export function validateAdministrativeAreaTotal(
  value: unknown,
): AdministrativeAreaTotal {
  if (typeof value !== 'string' || !ADMINISTRATIVE_AREA_PATTERN.test(value)) {
    throw new InvalidAdministrativeAreaError();
  }
  const [integer, fraction = ''] = value.split('.');
  if (
    (integer === '0' && (fraction.length === 0 || /^0+$/.test(fraction))) ||
    (integer.length === 10 &&
      `${integer}.${fraction.padEnd(4, '0')}` > ADMINISTRATIVE_AREA_MAXIMUM)
  ) {
    throw new InvalidAdministrativeAreaError();
  }
  return value as AdministrativeAreaTotal;
}

export function prepareCreateAdministrativeAreaTotal(
  value: unknown,
): AdministrativeAreaTotal | undefined {
  if (value === undefined) return undefined;
  return validateAdministrativeAreaTotal(value);
}

export function preparePatchAdministrativeAreaTotal(
  value: unknown,
): AdministrativeAreaTotal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return validateAdministrativeAreaTotal(value);
}
