---
title: Explaining Dirthara Entities
authors: [dirthara]
draft: true
tags: [entity, entity_builder, database, documentation]
---

# Dirthara Explained: Entities

One of the main goals we had when creating Dirthara was to use plain PHP wherever possible. Don't use framework magic
when plain PHP is all you need. _Inspired by magic, built without it_ is our tagline for a reason.

The entity package is perhaps the best example of this philosophy. Entities in Dirthara are just plain PHP classes.
No base class to extend, no interface to implement, no magic methods, and all your properties defined on the class. The
only things you explicitly need to tell Dirthara are things that cannot be inferred from the code itself.

{/* truncate */}

## Defining Entities

Since a code example says more than a thousand words, let's take a look at an example entity.

```php
<?php

declare(strict_types=1);

namespace App\Blog\Domain\Entity;

use DateTimeInterface;
use Dirthara\Entity\Attribute\Id;
use Dirthara\Entity\Attribute\Generated;

final class Post
{
    #[Id]
    #[Generated]
    public readonly int $id;

    public function __construct(
        public string $title,
        public string $content,
        public DateTimeInterface $createdAt,
        public ?DateTimeInterface $publishedAt,
    ) {}
}
```

This is the minimum amount of code you need to define an entity. Dirthara will be more than happy to work with it. There 
are a few more attributes you can use to describe your entity, which you can read about in the 
[documentation](https://dirthara.github.io/docs/). For the purpose of this article, though, we'll keep things simple.

:::info
This article focuses on the entity package. Schemas and migrations are separate packages in Dirthara and will be 
covered in a future article. For now, assume that the corresponding database tables and columns are already defined.
:::

Once you've defined your entity, you can use it to create, read, update, and delete data from your database. Dirthara 
provides a simple and intuitive API for working with entities: the Entity Manager. To use the Entity Manager, you 
need to first tell it which entity you want to work with. After that, the Entity Store for that entity becomes 
available.

## Entity Manager and Entity Store

Let's say we want to create a new post. We can use the Entity Manager and the Entity Store to do so.

```php
<?php

declare(strict_types=1);

namespace App\Blog\Application\Service;

use DateTimeImmutable;
use App\Blog\Domain\Entity\Post;
use Dirthara\Entity\EntityManager;

final readonly class CreatePostService
{
    public function __construct(
        private EntityManager $entityManager, 
    ) {}
    
    public function create(string $title, string $content, bool $published): Post
    {
        $post = new Post(
            title: $title, 
            content: $content, 
            createdAt: new DateTimeImmutable(),
            publishedAt: $published ? new DateTimeImmutable() : null,
        );
        
        $this->entityManager
            ->of(Post::class)
            ->insert($post)
        ;
        
        return $post;
    }
}
```

That's all. For entities with a single generated identity column, the Entity Store will automatically set the identity 
value on the entity after it has been inserted into the database.

## Entity Query

The Entity store has a number of methods for working with entities, like `find()`, `findOrFail`, `all()`, `update()`, 
`delete()`, and a few more you can read about in the [documentation](https://dirthara.github.io/docs/). If you want a 
little more control, or you need to add conditions, you can request the underlying Entity Query via the `query()` 
method. This will give you access to the `EntityQuery` class, which is a query builder for working with entities.

```php
<?php

declare(strict_types=1);

namespace App\Blog\Application\Service;

use DateTimeInterface;
use App\Blog\Domain\Entity\Post;
use Dirthara\Entity\EntityManager;
use Dirthara\Collection\Contract\Collection;

final readonly class GetPublishedPostsService
{
    public function __construct(
        private EntityManager $entityManager, 
    ) {}
    
    /**
     * @return Collection<int, Post>
     */
    public function get(DateTimeInterface $publishedBefore): Collection
    {
        return $this->entityManager
            ->of(Post::class)
            ->query()
            ->whereNotNull('publishedAt')
            ->where('publishedAt', '<', $publishedBefore)
            ->get()
        ;
    }
}
```

## Hydration

The Entity Query will automatically hydrate the entities in the collection for you because you are working with the 
Entity Query that is linked to the Post entity. You did this by using the `of()` method on the Entity Manager and 
telling the manager which entity you want to work with.

:::info
Note that we use the name of the PHP property in the `where()` method when using the Entity Query. This is because 
the Entity Query is designed to work with the properties of the entity, not the database columns. Even if your 
database column is named differently, when using the Entity Query, you must always use the property name.
:::

### Isn't that a little magic?

No. You are probably used to using the column names in a query builder, like in Laravel. But in Laravel there is no 
other choice, since Laravel models in general don't have properties for their columns, only magic methods. We 
purposefully made the choice to use the PHP property names in the Entity Query. The reason for this is that the entity 
itself knows how it is represented in the database. However, in your code you work with the entity, and at that point 
you don't need to know how it is represented in the database. The Entity abstracts the database layer away.

So how does the Entity Query know what the database column is called, isn't that a little magic? Again, no. By default, 
if no other information is available, the Entity Query just uses the same name for the column as the PHP property.
There are two ways to define a different database column name. First, you can use the `Column` attribute on the property 
and give it a `name`. This works fine for simple cases, but often you have a specific naming convention for your 
database columns. In that case you probably use the `Column` attribute a lot with the same type of name every time.

The second option to define a different database column name is to use a Naming Strategy. A Naming Strategy is a class 
that implements the `Dirthara\Entity\Naming\NamingStrategy` interface. This interface has five methods that need to be 
implemented, but only two of those are important for this specific use case: `table(string $entityShortName)` and 
`column(string $property)` (the other three methods are used for building the names of relations, which we will cover 
in the next article). If you have defined a Naming Strategy to use in the Entity Query, the entity builder will give the 
entity short name to the `table` method and use its result as the table name, and it will give the property name to the 
`column` method and use its result as the column name.

Dirthara comes with two Naming Strategies out of the box. The first one is the `NoNamingStrategy`; this will just use 
the short class name as the table name and the property name as the column name as they are. The second one is the 
`DefaultNamingStrategy`. For table names, this will use the plural form of the short class name in `snake_case`. For 
column names, it will use the property name in `snake_case`.

## Converters

:::info
Notice you also don't need to transform the `DateTimeInterface` value to a string when using the Entity Query. The
Entity Query will automatically do that for you as well. With the Entity Query you should always pass the values
like you would use them in the entity itself.
:::

The second magic-looking thing you may have noticed in the Entity Query is that you have to use the values in 
methods in the same way as they are in the entity itself. This actually has the same reason as why you use 
the entity properties instead of the column names: the entity knows how it is represented in the database, but you 
don't need to know that.

So how does the Entity Query know how to convert the values of the entity properties to the database column values, 
and how does it know how to convert the database column values to the entity properties? This is actually pretty 
straightforward. Since the entity itself is just a plain PHP class with typed properties, the Entity Query can 
automatically convert the values to the database column values and back for basically every built-in type.

Scalar values, `null`s, and backed enum values are a simple one-to-one conversion. Integers, for example, when fetched 
from the database are just cast to `int`, and when inserting into the database they are inserted as integers. For backed 
enums, the value is cast to the enum type when fetching from the database, and when inserting into the database, the 
enum value is used. 

Arrays by default are converted to JSON strings and back, though there is a second converter provided for arrays that 
uses serialized strings.

For more complex types, custom classes like value objects, for example, you can use a custom converter. Dirthara 
has converters for all the built-in types, including some complex types like `DateTimeInterface` and arrays. But you 
can also create your own converters.

Let's look at an example. Let's take the same `Post` entity as before but assume the `publishedAt` property is not a 
`datetime` column in the database, but just a `date` column. We can still use the `DateTimeInterface` type, but 
the default converter for `DateTimeInterface` uses both date and time, so we need to tell it this is only a date. We 
can do that by choosing a different converter for the `publishedAt` property, `date` in this case.

```php
<?php

declare(strict_types=1);

namespace App\Blog\Domain\Entity;

use DateTimeInterface;
use Dirthara\Entity\Attribute\Id;
use Dirthara\Entity\Attribute\Column;
use Dirthara\Entity\Attribute\Generated;

final class Post
{
    #[Id]
    #[Generated]
    public readonly int $id;

    public function __construct(
        public string $title,
        public string $content,
        public DateTimeInterface $createdAt,
        #[Column(converter: 'date')]
        public ?DateTimeInterface $publishedAt,
    ) {}
}
```

### Custom Converters

When you have a more complex custom property in your entity, like a value object, you will need to create a custom 
converter. Let's say we have a `User` entity that has an `EmailAddress` value object property.

```php
<?php

declare(strict_types=1);

namespace App\User\Domain\Entity;

use Dirthara\Entity\Attribute\Column;
use App\User\Domain\ValueObject\EmailAddress;
use App\User\Domain\Converter\EmailAddressConverter;

final class User
{
    // Other properties
    
    #[Column(converter: EmailAddressConverter::class)]
    public EmailAddress $email;
}
```

All you have to do is tell Dirthara which converter to use for the property. The converter itself is a pretty simple 
class that implements the `Dirthara\Entity\Type\ColumnConverter` interface. This interface declares three methods: 
`type()`, `toDatabase()` and `fromDatabase()`. 

The `type` method returns the type of the property this converter converts. In this case it would return 
`EmailAddress::class`. This is used if you just want to register the converter with the Type Registry instead of using 
it directly via the `Column` attribute. If you register the converter with the Type Registry, all properties of all 
entities with that type will use that converter. If you use it like above with the `Column` attribute, only that 
specific property will use that converter.

The other two methods are used to convert the value to and from the database.

```php
<?php

declare(strict_types=1);

namespace App\User\Domain\Converter;

use Dirthara\Entity\Type\ColumnConverter;
use App\User\Domain\ValueObject\EmailAddress;
use Dirthara\Entity\Exception\TypeConversionException;

class EmailAddressConverter implements ColumnConverter
{
    public function type(): string
    {
        return EmailAddress::class;
    }

    /**
     * @throws TypeConversionException
     */
    public function toDatabase(mixed $value): string
    {
        if (!$value instanceof EmailAddress) {
            throw TypeConversionException::invalidValue(expected: EmailAddress::class, actual: $value);
        }

        return $value->toString();
    }
    
    public function fromDatabase(mixed $value): EmailAddress
    {
        return new EmailAddress($value);
    }
}
```

## In conclusion

That is how Dirthara entities work in a nutshell. The entity package is built on the simple idea that entities are 
just plain PHP classes, and everything that can be done with plain PHP should be done with plain PHP. Of course, there 
are many more features and options available; for that you can read the [documentation](https://dirthara.github.io/docs/).

Next up: relationships. When working with entities, you will probably need to work with relationships at some point, 
and Dirthara has a great solution for that as well.