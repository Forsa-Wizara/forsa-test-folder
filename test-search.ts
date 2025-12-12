import { searchConventions } from './lib/conventions';

async function testSearch() {
  console.log('Testing search for "n"...');
  const results = await searchConventions({ partnerName: 'n', useFuzzy: true });
  console.log(`Found ${results.length} results:`);
  results.forEach(r => {
    console.log(`  - ${r.convention_id}: ${r.partner_name} (aliases: ${r.aliases.join(', ')})`);
  });

  console.log('\nTesting search for "établissement n"...');
  const results2 = await searchConventions({ partnerName: 'établissement n', useFuzzy: true });
  console.log(`Found ${results2.length} results:`);
  results2.forEach(r => {
    console.log(`  - ${r.convention_id}: ${r.partner_name}`);
  });

  console.log('\nTesting search for "N"...');
  const results3 = await searchConventions({ partnerName: 'N', useFuzzy: true });
  console.log(`Found ${results3.length} results:`);
  results3.forEach(r => {
    console.log(`  - ${r.convention_id}: ${r.partner_name}`);
  });
}

testSearch().catch(console.error);
