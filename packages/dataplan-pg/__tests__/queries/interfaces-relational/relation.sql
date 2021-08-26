select __relational_items_result__.*
from (
  select
    ids.ordinality - 1 as idx,
    (ids.value->>0)::"int4" as "id0"
  from json_array_elements($1::json) with ordinality as ids
) as __relational_items_identifiers__,
lateral (
  select
    __relational_items_2."type"::text as "0",
    __relational_items_2."id"::text as "1",
    __relational_items__."type"::text as "2",
    __relational_items__."id"::text as "3",
    __people__."username"::text as "4",
    __relational_items__."author_id"::text as "5",
    __relational_items_2."parent_id"::text as "6",
    __relational_items_identifiers__.idx as "7"
  from interfaces_and_unions.relational_items as __relational_items_2
  left outer join interfaces_and_unions.relational_items as __relational_items__
  on (__relational_items_2."parent_id"::"int4" = __relational_items__."id")
  left outer join interfaces_and_unions.people as __people__
  on (__relational_items__."author_id"::"int4" = __people__."person_id")
  where
    (
      true /* authorization checks */
    ) and (
      __relational_items_2."id" = __relational_items_identifiers__."id0"
    )
  order by __relational_items_2."id" asc
) as __relational_items_result__