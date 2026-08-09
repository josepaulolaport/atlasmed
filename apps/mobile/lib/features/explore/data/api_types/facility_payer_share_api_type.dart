import 'dart:convert';
import 'package:atlasmed_mobile_app/core/json/crm_id.dart';

import 'package:atlasmed_mobile_app/features/explore/data/api_types/query_builder.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/payer_catalog.dart';

/// DTO from `GET/PUT /facilities/:id/healthcare-provider-shares`.
class FacilityPayerShareApi {
  const FacilityPayerShareApi({
    required this.id,
    required this.facilityId,
    required this.healthcareProviderId,
    required this.sharePercent,
    required this.providerName,
    this.isPackage = false,
    this.providerType,
  });

  factory FacilityPayerShareApi.fromMap(Map<String, dynamic> map) {
    final provider =
        (map['healthcareProvider'] as Map?)?.cast<String, dynamic>() ??
        const {};
    return FacilityPayerShareApi(
      id: readCrmId(map['id'], 'id'),
      facilityId: readCrmId(map['facilityId'], 'facilityId'),
      healthcareProviderId: readCrmId(
        map['healthcareProviderId'],
        'healthcareProviderId',
      ),
      sharePercent: readNullableDouble(map['sharePercent']) ?? 0,
      providerName: readString(provider['name']),
      isPackage: map['isPackage'] == true,
      providerType: readString(provider['type']).isEmpty
          ? null
          : readString(provider['type']),
    );
  }

  final int id;
  final int facilityId;
  final int healthcareProviderId;
  final double sharePercent;
  final String providerName;
  final bool isPackage;
  final String? providerType;

  /// [PayerShare.id] is the healthcare provider id so the editor can match
  /// catalog entries when adding/removing rows.
  PayerShare toDomain() {
    return PayerShare(
      id: healthcareProviderId,
      name: providerName.isEmpty
          ? healthcareProviderId.toString()
          : providerName,
      sharePercent: sharePercent,
      isPackage: isPackage,
      type: providerType,
    );
  }
}

class FacilityPayerSharesResponse {
  const FacilityPayerSharesResponse({required this.items});

  factory FacilityPayerSharesResponse.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return FacilityPayerSharesResponse.fromMap(decoded);
  }

  factory FacilityPayerSharesResponse.fromMap(Map<String, dynamic> map) {
    return FacilityPayerSharesResponse(
      items: readObjectList(
        map['data'],
      ).map(FacilityPayerShareApi.fromMap).toList(growable: false),
    );
  }

  final List<FacilityPayerShareApi> items;

  List<PayerShare> toDomain() =>
      items.map((item) => item.toDomain()).toList(growable: false);
}

/// DTO from `GET /healthcare-providers`.
class HealthcareProviderApi {
  const HealthcareProviderApi({
    required this.id,
    required this.name,
    required this.type,
    required this.isActive,
  });

  factory HealthcareProviderApi.fromMap(Map<String, dynamic> map) {
    return HealthcareProviderApi(
      id: readCrmId(map['id'], 'id'),
      name: readString(map['name']),
      type: readString(map['type']),
      isActive: map['isActive'] != false,
    );
  }

  final int id;
  final String name;
  final String type;
  final bool isActive;

  PayerCatalogEntry toCatalogEntry() =>
      PayerCatalogEntry(id: id, name: name, type: type);
}

class PaginatedHealthcareProviders {
  const PaginatedHealthcareProviders({required this.items});

  factory PaginatedHealthcareProviders.fromJson(String json) {
    final decoded = jsonDecode(json) as Map<String, dynamic>;
    return PaginatedHealthcareProviders.fromMap(decoded);
  }

  factory PaginatedHealthcareProviders.fromMap(Map<String, dynamic> map) {
    return PaginatedHealthcareProviders(
      items: readObjectList(
        map['data'],
      ).map(HealthcareProviderApi.fromMap).toList(growable: false),
    );
  }

  final List<HealthcareProviderApi> items;
}
