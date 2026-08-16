import 'package:atlasmed_mobile_app/features/users/presentation/widgets/territory_picker_screen.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('canConfirm', () {
    test('nothing picked and nothing to clear leaves the button dead', () {
      expect(
        territoryPickerCanConfirm(selectedCount: 0, hadInitialSelection: false),
        isFalse,
      );
    });

    test('emptying an existing selection is still a real action', () {
      expect(
        territoryPickerCanConfirm(selectedCount: 0, hadInitialSelection: true),
        isTrue,
      );
    });

    test('a fresh pick can be confirmed', () {
      expect(
        territoryPickerCanConfirm(selectedCount: 2, hadInitialSelection: false),
        isTrue,
      );
    });
  });

  group('confirmLabel', () {
    String label({
      required int selectedCount,
      bool hadInitialSelection = false,
      bool singleSelect = false,
    }) => territoryPickerConfirmLabel(
      selectedCount: selectedCount,
      hadInitialSelection: hadInitialSelection,
      singleSelect: singleSelect,
    );

    test('with nothing picked it prompts rather than promising to confirm', () {
      expect(label(selectedCount: 0), 'Selecione no mapa');
      expect(label(selectedCount: 0, singleSelect: true), 'Selecione uma zona');
    });

    test('emptying an existing selection says what it will do', () {
      expect(
        label(selectedCount: 0, hadInitialSelection: true),
        'Remover seleção',
      );
    });

    test('counts a multi-select', () {
      expect(label(selectedCount: 3), 'Confirmar (3)');
    });

    test('a single-select confirms the one zone', () {
      expect(label(selectedCount: 1, singleSelect: true), 'Confirmar zona');
    });
  });
}
