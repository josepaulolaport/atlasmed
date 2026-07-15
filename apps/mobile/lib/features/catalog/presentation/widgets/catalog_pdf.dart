import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../../shared/utils/formatters.dart';
import '../../data/catalog_models.dart';

/// Builds and presents a shareable/printable PDF for a product family.
Future<void> generateProductPdf(ProductFamily family) async {
  final doc = pw.Document();
  doc.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      build: (ctx) {
        return pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(
              'Informações ${family.name}',
              style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold),
            ),
            pw.SizedBox(height: 16),
            pw.TableHelper.fromTextArray(
              headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold),
              headers: const [
                'Produto',
                'SIMPRO',
                'BRASÍNDICE',
                'TISS',
                'Valor',
              ],
              data: family.variants
                  .map(
                    (v) => [
                      v.name,
                      v.simproCode,
                      v.brasindiceCode,
                      v.tissCode,
                      formatBrl(v.price),
                    ],
                  )
                  .toList(),
            ),
            pw.SizedBox(height: 20),
            pw.Text('PUBLICAÇÃO:'),
            pw.Text('BRASÍNDICE: ${formatDateBr(family.brasindicePublishedAt)}'),
            pw.Text('SIMPRO: ${formatDateBr(family.simproPublishedAt)}'),
          ],
        );
      },
    ),
  );

  await Printing.layoutPdf(onLayout: (format) async => doc.save());
}
