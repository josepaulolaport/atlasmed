// ── Payment method enum ─────────────────────────────────────
enum PaymentMethod { credit, debit, boleto, transfer, cash }

extension PaymentMethodX on PaymentMethod {
  String get label {
    switch (this) {
      case PaymentMethod.credit:
        return 'Cartão de crédito';
      case PaymentMethod.debit:
        return 'Cartão de débito';
      case PaymentMethod.boleto:
        return 'Boleto';
      case PaymentMethod.transfer:
        return 'Transferência';
      case PaymentMethod.cash:
        return 'Dinheiro';
    }
  }

  String toJson() => name.toUpperCase();
}

PaymentMethod paymentMethodFromJson(String json) {
  switch (json.toUpperCase()) {
    case 'CREDIT':
      return PaymentMethod.credit;
    case 'DEBIT':
      return PaymentMethod.debit;
    case 'BOLETO':
      return PaymentMethod.boleto;
    case 'TRANSFER':
      return PaymentMethod.transfer;
    case 'CASH':
      return PaymentMethod.cash;
    default:
      return PaymentMethod.credit;
  }
}
