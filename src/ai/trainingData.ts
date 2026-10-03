import type { SignalLabel } from "../domain/labels";

export interface TrainingCase {
  text: string;
  labels: SignalLabel[];
}

const SINGLE: Record<SignalLabel, string[]> = {
  PRAISE_EXPERIENCE: [
    "the coffee roasting was amazing","we loved the farm walk","the guide was excellent","the view was beautiful","the lunch was delicious",
    "coffee roasting was the best part","tulipenda kuchoma kahawa","ziara ilikuwa nzuri sana","chakula kilikuwa kitamu","the experience was really good",
    "we really enjoyed the coffee experience","the host was wonderful","the farm tour was lovely","the scenery was incredible","the tasting was my favorite part",
    "everything about the visit was great","we had a fantastic time","the guide made the experience special","the walk through the farm was beautiful",
    "this was one of the best things we did","ziara ilitupendeza sana","mwongoza alikuwa mzuri sana","mandhari ilikuwa nzuri","tulipenda uzoefu huu",
    "the place sweet well well","this tour make sense"
  ],
  WANT_PRODUCT: [
    "can we buy coffee beans","do you sell coffee to take home","i want to buy some beans","can i purchase the coffee here","we would like to take coffee home",
    "naweza kununua kahawa","mnauza kahawa hapa","nataka kununua maharagwe ya kahawa","abeg can we buy coffee","i want some of this coffee to take away",
    "can i buy a bag of beans","where can i purchase the coffee","do you have beans for sale","i want to take some coffee home","can we order this coffee",
    "is the honey for sale","can i buy the jam we tasted","do you sell any farm products","i would like to purchase two bags","can we get some of this to take away",
    "naweza kununua maharagwe","mnauza asali hapa","nataka kununua bidhaa hizi","naweza kununua hii niende nayo","abeg i fit buy this one","una dey sell the coffee beans"
  ],
  WANT_ACTIVITY: [
    "can we try roasting the coffee","i want to pick coffee cherries","can visitors join the cooking","we would like to do the farm walk","can i try feeding the animals",
    "tunaweza kuchoma kahawa","nataka kushiriki kuvuna kahawa","naweza kufanya matembezi ya shamba","can we join the roasting","i wish we could try this ourselves",
    "can we join the coffee picking","can i try roasting beans","can visitors help with harvesting","i want to take part in the cooking","can we do the waterfall walk",
    "can we feed the animals","is it possible to try the farm work","we want to join the tasting","can the children try picking fruit","could we do this activity ourselves",
    "tunaweza kushiriki kuvuna","naweza kujaribu kuchoma kahawa","tunaweza kufanya matembezi","nataka kushiriki shughuli","abeg make we try the roasting","we fit join harvest"
  ],
  WANT_BOOKING: [
    "can eight of us come on saturday","i want to book a visit","are you free next sunday","can our group visit tomorrow","we would like to reserve the tour",
    "tunaweza kuja jumamosi","nataka kuweka nafasi ya ziara","mko wazi jumapili","can i book for four people","is there space for us next week",
    "can i reserve for saturday","we want to visit next week","is there room for ten people","can we book tomorrow morning","i need a reservation for four",
    "are you available on sunday","can a group of twelve come","we would like to schedule a visit","can we reserve the afternoon tour","i want to bring a group next month",
    "nataka kuweka nafasi jumamosi","tunaweza kuja kesho","mna nafasi kwa watu sita","naweza kuhifadhi ziara","abeg i wan book for saturday","we fit come sunday"
  ],
  ASK_ACCESS: [
    "how do we get to the farm","where is the farm located","is there transport from town","can someone pick us up","which road should we take",
    "tutafikaje shambani","shamba liko wapi","kuna usafiri kutoka mjini","abeg which side this place dey","how far is it from town",
    "what is the best way to reach you","how far is the farm from town","which road goes to the farm","is there a bus from the station","do you provide pickup",
    "where exactly are you located","can we get a taxi there","how do we find the entrance","is the farm close to the main road","can you send directions",
    "tutafikaje huko","iko mbali na mjini","kuna gari la kutuleta","njia gani inafika shambani","abeg how i go reach una","which side the place dey"
  ],
  ASK_PRICE: [
    "how much is the tour","what is the entry fee","how much does it cost","is lunch included in the price","what does the fee cover",
    "bei ya ziara ni kiasi gani","gharama ni ngapi","kiingilio ni kiasi gani","how much be entry","what are the other charges",
    "what is the price per person","how much is admission","what do we pay for the tour","is lunch part of the fee","does the price include the activities",
    "how much for children","what are the extra charges","what does the entrance fee include","how much should i budget","is there a separate fee for roasting",
    "bei kwa mtu ni ngapi","kiingilio ni pesa ngapi","chakula kipo kwenye bei","gharama nyingine ni zipi","how much una dey charge","wetin be the entry fee"
  ],
  ASK_PAYMENT: [
    "do you accept card","can i pay with mobile money","is cash the only option","can we pay by card","do you take mpesa",
    "mnakubali kadi","naweza kulipa kwa mpesa","malipo ni kwa pesa taslimu tu","una accept transfer","can i pay with bank transfer",
    "can i pay using visa","do you accept mastercard","can we use a debit card","do you take cash","is mobile money accepted",
    "can i pay with mpesa","do you accept bank transfer","what payment methods do you take","can we pay electronically","will my card work there",
    "mnakubali mpesa","naweza kulipa kwa kadi","mnakubali pesa taslimu","malipo yanafanywaje","una accept pos","i fit transfer"
  ],
  FRICTION_ACCESS: [
    "we got lost on the way","the road was terrible","the farm was hard to find","transport here was difficult","the road is too rough",
    "tulipotea njiani","barabara ilikuwa mbaya","ilikuwa vigumu kufika","road bad die","getting here was stressful",
    "the road was in very poor condition","we struggled to find the entrance","our taxi refused to go further","there were no signs and we got lost",
    "getting there took much longer than expected","the access road was difficult","transport back to town was a problem","the road was muddy and hard to drive",
    "we could not find the place easily","the directions were confusing and we got lost","barabara ilikuwa mbovu","tulipata shida kufika",
    "hakukuwa na alama za njia","tulipotea tukitafuta shamba","road rough well well","we suffer reach there"
  ],
  FRICTION_VALUE: [
    "the tour was too expensive","it was not worth the price","we paid too much","the entry fee was too high","ten thousand for forty minutes is too much",
    "bei ilikuwa juu sana","haikustahili bei","gharama ilikuwa kubwa","too expensive for nothing","the price felt unfair",
    "the experience was overpriced","the fee was too much for what we got","it did not feel worth the money","we paid a lot for a very short tour",
    "the extra charges were too high","the price was disappointing","it cost more than the experience was worth","the admission felt expensive",
    "the value for money was poor","we expected more for that price","bei ilikuwa ghali mno","gharama haikulingana na uzoefu",
    "tulilipa sana kwa ziara fupi","bei haikuwa sawa","price too much abeg","e cost pass wetin we get"
  ],
  FRICTION_EXPECTATION: [
    "the website said lunch was included but it was not","this was different from what was advertised","we expected more activities","the photos looked better than the real place",
    "nobody told us part of the tour was closed","haikuwa kama ilivyoelezwa","tulitarajia shughuli zaidi","website said one thing but we met another","not what they promised",
    "what we got was different from the listing","the experience did not match the description","several advertised activities were unavailable",
    "the listing promised lunch but there was none","the photos made the place look very different","we were told the waterfall was open but it was closed",
    "what we got was not what was advertised","the website information was out of date","we expected a working farm but it felt like a hotel",
    "the tour was different from the booking description","an activity we paid for was not available","haikuwa kama tangazo lilivyosema",
    "shughuli zilizotangazwa hazikuwepo","tovuti ilisema chakula kimejumuishwa lakini hakikuwepo","maelezo hayakulingana na tulichokuta",
    "website talk another thing","na different thing we meet"
  ],
  REQUIREMENT_ACCESSIBILITY: [
    "my mother cannot manage steep paths","we need wheelchair access","i cannot walk very far","is there an easier route for an elderly guest","we need somewhere to sit during the walk",
    "mama yangu hawezi kupanda njia kali","nahitaji njia ya kiti cha magurudumu","siwezi kutembea mbali","my papa no fit climb this hill","we need a shorter accessible route",
    "we need a route without stairs","one guest uses crutches","is there seating along the route","my father cannot walk long distances","we need a gentler path",
    "can an elderly person avoid the steep section","we need wheelchair friendly access","one guest has limited mobility","can we skip the long hike",
    "we need regular rest stops","tunahitaji njia bila ngazi","mgeni mmoja anatumia kiti cha magurudumu","baba yangu hawezi kutembea mbali",
    "tunahitaji njia rahisi","my mama no fit waka far","we need easy road for old person"
  ],
  REQUIREMENT_DIETARY_SAFETY: [
    "i have a peanut allergy","is the food vegan","my child has asthma","i cannot eat dairy","we need a vegetarian meal",
    "nina mzio wa karanga","chakula kina karanga","mimi ni mboga","mtoto wangu ana pumu","i am allergic to nuts",
    "i have a shellfish allergy","please avoid peanuts","one guest is diabetic","we need gluten free food","is the meal vegetarian",
    "i cannot eat eggs","my son has a severe allergy","does this contain nuts","we need food without dairy","one guest has a medical condition",
    "nahitaji chakula bila maziwa","mgeni mmoja ni mboga","mtoto ana mzio mkali","i no fit chop groundnut","my pikin get allergy"
  ],
  COMMUNICATION_GAP: [
    "i did not understand the guide","nobody explained what was included","the instructions were unclear","we were not told where to meet","i could not understand the story",
    "sikuelewa maelezo ya mwongoza","hakuna aliyetuambia tulikutana wapi","maelezo hayakuwa wazi","guide no explain am well","we were confused about what to do",
    "we did not know where to check in","the meeting instructions were confusing","nobody told us the schedule","we could not understand the explanation",
    "the guide did not explain the rules","we were unsure what was included","the booking message was unclear","we did not know what to bring",
    "nobody explained the next step","the information was difficult to understand","hatukujua pa kukutana","maelekezo hayakuwa wazi",
    "sikuelewa maelezo","hakuna aliyeeleza ratiba","nobody explain am","we no understand the instructions"
  ],
  RETURN_REFERRAL: [
    "i would come again","i will recommend this to my friends","we want to bring our family next time","i would definitely return","i am telling my colleagues about this place",
    "nitakuja tena","nitapendekeza kwa marafiki","tutaleta familia yetu wakati mwingine","i go come back again","i would bring other people here",
    "we will definitely visit again","i am recommending this place to everyone","i want to return with my family","i would tell friends to come here",
    "we plan to come back","i will bring colleagues next time","this is somewhere i would recommend","we would visit again",
    "i have already told friends about it","i want to return next season","tutarudi tena","nitawaambia marafiki waje",
    "nitarudi na familia","nitapendekeza eneo hili","i go bring my people next time","i go recommend una"
  ],
  UNKNOWN: [
    "the coffee is brown","we arrived at noon","there were six chairs","today is monday","the building has a red roof",
    "i wore blue shoes","the guide's name is john","we took three photos","the farm has trees","the weather changed",
    "kahawa ni kahawia","tulifika saa sita","kulikuwa na viti sita","leo ni jumatatu","shamba lina miti",
    "i reach around twelve","the place get plenty tree","my shirt na blue","we snap picture","there is a gate",
    "coffee grows here","the tour starts outside","we came by car","the farm is on a hill","i saw two goats"
  ],
};

const MULTI: TrainingCase[] = [
  { text: "we loved the roasting and want to buy beans", labels: ["PRAISE_EXPERIENCE","WANT_PRODUCT"] },
  { text: "the tour was lovely but the road was terrible", labels: ["PRAISE_EXPERIENCE","FRICTION_ACCESS"] },
  { text: "the scenery was beautiful but the price was too high", labels: ["PRAISE_EXPERIENCE","FRICTION_VALUE"] },
  { text: "how much is entry and can i pay by card", labels: ["ASK_PRICE","ASK_PAYMENT"] },
  { text: "can we book saturday and try roasting", labels: ["WANT_BOOKING","WANT_ACTIVITY"] },
  { text: "my mother cannot walk far and i have a nut allergy", labels: ["REQUIREMENT_ACCESSIBILITY","REQUIREMENT_DIETARY_SAFETY"] },
  { text: "we got lost and the meeting instructions were unclear", labels: ["FRICTION_ACCESS","COMMUNICATION_GAP"] },
  { text: "the website promised lunch but it was missing and the fee felt too high", labels: ["FRICTION_EXPECTATION","FRICTION_VALUE"] },
  { text: "the guide was wonderful but i could not understand the story", labels: ["PRAISE_EXPERIENCE","COMMUNICATION_GAP"] },
  { text: "the place was excellent and we will bring friends next time", labels: ["PRAISE_EXPERIENCE","RETURN_REFERRAL"] },
  { text: "tulipenda ziara lakini barabara ilikuwa mbaya sana", labels: ["PRAISE_EXPERIENCE","FRICTION_ACCESS"] },
  { text: "bei ni ngapi na mnakubali mpesa", labels: ["ASK_PRICE","ASK_PAYMENT"] },
  { text: "mama hawezi kutembea mbali na nina mzio wa karanga", labels: ["REQUIREMENT_ACCESSIBILITY","REQUIREMENT_DIETARY_SAFETY"] },
  { text: "naweza kununua kahawa na kuweka nafasi jumamosi", labels: ["WANT_PRODUCT","WANT_BOOKING"] },
  { text: "abeg how much and una accept pos", labels: ["ASK_PRICE","ASK_PAYMENT"] },
  { text: "place sweet but road rough", labels: ["PRAISE_EXPERIENCE","FRICTION_ACCESS"] },
  { text: "my papa no fit climb and i wan buy coffee", labels: ["REQUIREMENT_ACCESSIBILITY","WANT_PRODUCT"] },
  { text: "tour make sense and i go bring my friends", labels: ["PRAISE_EXPERIENCE","RETURN_REFERRAL"] },
  { text: "can we reserve sunday and do you provide pickup", labels: ["WANT_BOOKING","ASK_ACCESS"] },
  { text: "i want to try picking and buy beans after", labels: ["WANT_ACTIVITY","WANT_PRODUCT"] },
  { text: "the experience was lovely but not like the website showed", labels: ["PRAISE_EXPERIENCE","FRICTION_EXPECTATION"] },
  { text: "we want to visit saturday but how do we get there", labels: ["WANT_BOOKING","ASK_ACCESS"] },
  { text: "the meal was great but i have a peanut allergy", labels: ["PRAISE_EXPERIENCE","REQUIREMENT_DIETARY_SAFETY"] },
  { text: "we loved it but my father needs an easier route", labels: ["PRAISE_EXPERIENCE","REQUIREMENT_ACCESSIBILITY"] },
  { text: "can we buy coffee and pay by card", labels: ["WANT_PRODUCT","ASK_PAYMENT"] },
];

export const TRAINING_CASES: TrainingCase[] = [
  ...Object.entries(SINGLE).flatMap(([label, examples]) =>
    examples.map((text) => ({ text, labels: [label as SignalLabel] }))
  ),
  ...MULTI,
  ...MULTI,
];

export const FROZEN_TEST_CASES: TrainingCase[] = [
  { text: "The coffee tasting was excellent and I want to take two packs home.", labels: ["PRAISE_EXPERIENCE","WANT_PRODUCT"] },
  { text: "Can I reserve a morning visit for my parents this Friday?", labels: ["WANT_BOOKING"] },
  { text: "What is the cheapest way to get there from the bus station?", labels: ["ASK_ACCESS"] },
  { text: "How much do children pay?", labels: ["ASK_PRICE"] },
  { text: "Will you accept a debit card?", labels: ["ASK_PAYMENT"] },
  { text: "The road to the farm was so rough our taxi stopped halfway.", labels: ["FRICTION_ACCESS"] },
  { text: "The tour felt too costly for what was offered.", labels: ["FRICTION_VALUE"] },
  { text: "Your page said there would be lunch, but no meal was provided.", labels: ["FRICTION_EXPECTATION"] },
  { text: "My grandmother needs a route without steep stairs.", labels: ["REQUIREMENT_ACCESSIBILITY"] },
  { text: "One person in our group has a serious nut allergy.", labels: ["REQUIREMENT_DIETARY_SAFETY"] },
  { text: "We were never told where to meet the guide.", labels: ["COMMUNICATION_GAP"] },
  { text: "I have already told my friends they should visit.", labels: ["RETURN_REFERRAL"] },
  { text: "Could we help roast the beans ourselves?", labels: ["WANT_ACTIVITY"] },
  { text: "The farm walk was beautiful.", labels: ["PRAISE_EXPERIENCE"] },
  { text: "Do you sell the coffee we tasted?", labels: ["WANT_PRODUCT"] },
  { text: "Can ten of us come next Sunday and how much is it per person?", labels: ["WANT_BOOKING","ASK_PRICE"] },
  { text: "We loved the experience, but finding the entrance was difficult.", labels: ["PRAISE_EXPERIENCE","FRICTION_ACCESS"] },
  { text: "I enjoyed the tour, though the website made it look much bigger.", labels: ["PRAISE_EXPERIENCE","FRICTION_EXPECTATION"] },
  { text: "Do you accept M-Pesa and can we buy honey?", labels: ["ASK_PAYMENT","WANT_PRODUCT"] },
  { text: "My father cannot walk far, but he would love to join the tasting.", labels: ["REQUIREMENT_ACCESSIBILITY","WANT_ACTIVITY"] },
  { text: "Tunaweza kununua kahawa tuliyoonja?", labels: ["WANT_PRODUCT"] },
  { text: "Ziara ilikuwa nzuri sana.", labels: ["PRAISE_EXPERIENCE"] },
  { text: "Tutafikaje kutoka kituo cha basi?", labels: ["ASK_ACCESS"] },
  { text: "Mnakubali malipo kwa kadi?", labels: ["ASK_PAYMENT"] },
  { text: "Mama yangu hawezi kupanda ngazi nyingi.", labels: ["REQUIREMENT_ACCESSIBILITY"] },
  { text: "Bei ilikuwa ghali sana kwa muda mfupi wa ziara.", labels: ["FRICTION_VALUE"] },
  { text: "Abeg how much una dey collect per person?", labels: ["ASK_PRICE"] },
  { text: "Road to this place bad well well.", labels: ["FRICTION_ACCESS"] },
  { text: "I fit book for six people on Saturday?", labels: ["WANT_BOOKING"] },
  { text: "This place sweet, I go tell my guys make dem come.", labels: ["PRAISE_EXPERIENCE","RETURN_REFERRAL"] },
  { text: "My shirt is green.", labels: ["UNKNOWN"] },
  { text: "We came at 1pm.", labels: ["UNKNOWN"] },
  { text: "There are coffee trees behind the house.", labels: ["UNKNOWN"] },
  { text: "The guide is called Peter.", labels: ["UNKNOWN"] },
  { text: "We took a photo near the gate.", labels: ["UNKNOWN"] },
];
