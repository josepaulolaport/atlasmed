import 'dart:async';

import 'package:atlasmed_mobile_app/features/roteiro/data/repositories/roteiro_repository.dart';
import 'package:atlasmed_mobile_app/features/roteiro/data/roteiro.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:flutter/material.dart';

/// Picks a clinic to add to the day.
///
/// Shows the rep's whole book for the linha, not the engine's candidates. A rep
/// reaching for this has a reason the engine does not have — a call they took,
/// a doctor expecting them — so hiding a clinic because it scored badly or sits
/// outside the radius would defeat the point. Whether the day can *hold* it is
/// answered by the regeneration that follows, which says so when it cannot.
class AddClinicSheet extends StatefulWidget {
  const AddClinicSheet({
    super.key,
    required this.repository,
    required this.verticalId,
    required this.alreadyInSlate,
  });

  final RoteiroRepository repository;
  final int verticalId;

  /// Clinics already on the day, shown as such rather than hidden — a rep
  /// searching for one they already added should see that, not an empty result.
  final Set<int> alreadyInSlate;

  @override
  State<AddClinicSheet> createState() => _AddClinicSheetState();
}

class _AddClinicSheetState extends State<AddClinicSheet> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<AddableClinic> _results = const [];
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _search(null);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    // Debounced: a rep types a clinic name faster than the round trip, and a
    // request per keystroke would race its own results into the list.
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(value));
  }

  Future<void> _search(String? query) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await widget.repository.addable(
        verticalId: widget.verticalId,
        query: query,
      );
      if (!mounted) return;
      setState(() {
        _results = results;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.72,
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.gray300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                child: TextField(
                  controller: _controller,
                  onChanged: _onChanged,
                  autofocus: true,
                  decoration: const InputDecoration(
                    hintText: 'Buscar clínica',
                    prefixIcon: Icon(Icons.search, size: 20),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              Expanded(child: _body()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Não foi possível buscar clínicas.\n$_error',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: AppColors.gray600),
          ),
        ),
      );
    }
    if (_results.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Nenhuma clínica encontrada na sua carteira.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.gray600),
          ),
        ),
      );
    }
    return ListView.separated(
      itemCount: _results.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (_, index) {
        final clinic = _results[index];
        final already = widget.alreadyInSlate.contains(
          clinic.facilityVerticalProfileId,
        );
        return ListTile(
          title: Text(
            clinic.facilityName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          subtitle: clinic.place == null
              ? null
              : Text(
                  clinic.place!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.gray500,
                  ),
                ),
          trailing: already
              ? const Text(
                  'No roteiro',
                  style: TextStyle(fontSize: 11, color: AppColors.gray500),
                )
              : const Icon(Icons.add, size: 20, color: AppColors.navyBright),
          enabled: !already,
          onTap: already
              ? null
              : () =>
                    Navigator.of(context).pop(clinic.facilityVerticalProfileId),
        );
      },
    );
  }
}
