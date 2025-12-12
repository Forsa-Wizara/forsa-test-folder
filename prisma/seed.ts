import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // ============================================================================
  // SEED CONVENTIONS
  // ============================================================================
  console.log('\n📋 Seeding conventions...');
  
  const conventionsPath = path.join(process.cwd(), 'data', 'docs-conv.json');
  const conventionsData = JSON.parse(fs.readFileSync(conventionsPath, 'utf-8'));

  for (const conv of conventionsData) {
    console.log(`  → Creating convention: ${conv.partner_name}`);
    
    await prisma.convention.create({
      data: {
        conventionId: conv.convention_id,
        partnerName: conv.partner_name,
        aliases: JSON.stringify(conv.aliases),
        clientType: conv.client_type,
        documents: JSON.stringify(conv.documents),
        notes: conv.notes || null,
        eligibility: {
          create: {
            active: conv.eligibility.active ?? false,
            retired: conv.eligibility.retired ?? false,
            family: conv.eligibility.family ?? false,
            familyDetails: conv.eligibility.family_details || null,
            subsidiaries: conv.eligibility.subsidiaries ?? false,
            widowsInvalids: conv.eligibility.widows_invalids ?? false,
            secondAccess: conv.eligibility.second_access ?? false,
            secondAccessCondition: conv.eligibility.second_access_condition || null,
            hierarchical: conv.eligibility.hierarchical ?? false,
            civil: conv.eligibility.civil ?? false,
            adherents: conv.eligibility.adherents ?? false,
            conditions: conv.eligibility.conditions ? JSON.stringify(conv.eligibility.conditions) : null,
            details: conv.eligibility.details || null,
          },
        },
        offers: {
          create: conv.offers.map((offer: any) => ({
            category: offer.category,
            technology: offer.technology || null,
            speedMbps: offer.speed_mbps || null,
            plan: offer.plan || null,
            volumeGo: offer.volume_go || null,
            frequency: offer.frequency || null,
            product: offer.product || null,
            type: offer.type || null,
            model: offer.model || null,
            provider: offer.provider || null,
            priceConventionDa: offer.price_convention_da,
            pricePublicDa: offer.price_public_da || null,
            discount: offer.discount || null,
            condition: offer.condition || null,
            label: offer.label || null,
            note: offer.note || null,
          })),
        },
      },
    });
  }

  console.log(`✅ Seeded ${conventionsData.length} conventions`);

  // ============================================================================
  // SEED OFFRES RÉFÉRENTIEL
  // ============================================================================
  console.log('\n📦 Seeding offres référentiel...');
  
  const offresPath = path.join(process.cwd(), 'data', 'offres.json');
  const offresData = JSON.parse(fs.readFileSync(offresPath, 'utf-8'));

  for (const offre of offresData.referentiel_offres) {
    console.log(`  → Creating offre: ${offre.nom_commercial}`);
    
    await prisma.offreReferentiel.create({
      data: {
        idOffre: offre.id_offre,
        nomCommercial: offre.nom_commercial,
        famille: offre.famille,
        sousFamille: offre.sous_famille,
        technologies: JSON.stringify(offre.technologies),
        segmentsCibles: JSON.stringify(offre.segments_cibles),
        sousSegments: JSON.stringify(offre.sous_segments),
        clientType: offre.client_type,
        locataire: offre.locataire ?? null,
        conventionne: offre.conventionne ?? null,
        typesClientsExclus: JSON.stringify(offre.types_clients_exclus),
        typeOffre: offre.type_offre,
        engagementMois: offre.engagement_mois ?? null,
        numeroDocument: offre.numero_document,
        canauxActivation: JSON.stringify(offre.canaux_activation),
        periodeActivation: offre.periode_activation ? JSON.stringify(offre.periode_activation) : null,
        validite: offre.validite ? JSON.stringify(offre.validite) : null,
        debitsEligibles: offre.debits_eligibles ? JSON.stringify(offre.debits_eligibles) : null,
        caracteristiquesDebit: offre.caracteristiques_debit ? JSON.stringify(offre.caracteristiques_debit) : null,
        tarification: JSON.stringify(offre.tarification),
        avantagesPrincipaux: JSON.stringify(offre.avantages_principaux),
        limitations: JSON.stringify(offre.limitations),
        conditionsParticulieres: JSON.stringify(offre.conditions_particulieres),
        modesPaiement: JSON.stringify(offre.modes_paiement),
        documentsAFournir: JSON.stringify(offre.documents_a_fournir),
        notes: JSON.stringify(offre.notes),
        tableauxTarifaires: {
          create: offre.tableaux_tarifaires.map((tableau: any) => ({
            typeTableau: tableau.type_tableau,
            unitePrix: tableau.unite_prix,
            lignes: JSON.stringify(tableau.lignes),
          })),
        },
        produitsAssocies: {
          create: offre.produits_associes.map((produit: any) => ({
            typeProduit: produit.type_produit,
            designation: produit.designation,
            tarifActuelDaTtc: produit.tarif_actuel_da_ttc ?? null,
            tarifNouveauDaTtc: produit.tarif_nouveau_da_ttc ?? null,
            conditions: produit.conditions ? JSON.stringify(produit.conditions) : null,
          })),
        },
      },
    });
  }

  console.log(`✅ Seeded ${offresData.referentiel_offres.length} offres référentiel`);
  console.log('\n🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
